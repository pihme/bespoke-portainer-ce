package main

import (
	"cmp"
	"context"
	"crypto/sha256"
	"os"
	"path"
	"strings"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/cli"
	"github.com/portainer/portainer/api/crypto"
	"github.com/portainer/portainer/api/database"
	"github.com/portainer/portainer/api/database/boltdb"
	"github.com/portainer/portainer/api/database/models"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/datastore/migrator"
	"github.com/portainer/portainer/api/datastore/postinit"
	"github.com/portainer/portainer/api/docker"
	dockerclient "github.com/portainer/portainer/api/docker/client"
	"github.com/portainer/portainer/api/exec"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/git"
	"github.com/portainer/portainer/api/gitops/scheduling"
	"github.com/portainer/portainer/api/http"
	"github.com/portainer/portainer/api/http/proxy"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/authorization"
	"github.com/portainer/portainer/api/internal/endpointutils"
	"github.com/portainer/portainer/api/internal/snapshot"
	"github.com/portainer/portainer/api/internal/ssl"
	"github.com/portainer/portainer/api/kubernetes"
	kubecli "github.com/portainer/portainer/api/kubernetes/cli"
	"github.com/portainer/portainer/api/logs"
	"github.com/portainer/portainer/api/platform"
	"github.com/portainer/portainer/api/scheduler"
	"github.com/portainer/portainer/api/stacks/deployments"
	"github.com/portainer/portainer/pkg/build"
	"github.com/portainer/portainer/pkg/featureflags"
	"github.com/portainer/portainer/pkg/fips"
	"github.com/portainer/portainer/pkg/libhttp/ssrf"
	"github.com/portainer/portainer/pkg/libstack/compose"
	"github.com/portainer/portainer/pkg/validate"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func initCLI() *portainer.CLIFlags {
	cliService := cli.Service{}

	flags, err := cliService.ParseFlags(portainer.APIVersion)
	if err != nil {
		log.Fatal().Err(err).Msg("failed parsing flags")
	}

	if err := cliService.ValidateFlags(flags); err != nil {
		log.Fatal().Err(err).Msg("failed validating flags")
	}

	return flags
}

func initFileService(dataStorePath string) portainer.FileService {
	fileService, err := filesystem.NewService(dataStorePath, "")
	if err != nil {
		log.Fatal().Err(err).Msg("failed creating file service")
	}

	return fileService
}

func initDataStore(flags *portainer.CLIFlags, secretKey []byte, fileService portainer.FileService, shutdownCtx context.Context) dataservices.DataStore {
	connection, err := database.NewDatabase("boltdb", *flags.Data, secretKey, *flags.CompactDB)
	if err != nil {
		log.Fatal().Err(err).Msg("failed creating database connection")
	}

	if bconn, ok := connection.(*boltdb.DbConnection); ok {
		bconn.MaxBatchSize = *flags.MaxBatchSize
		bconn.MaxBatchDelay = *flags.MaxBatchDelay
		bconn.InitialMmapSize = *flags.InitialMmapSize
	} else {
		log.Fatal().Msg("failed creating database connection: expecting a boltdb database type but a different one was received")
	}

	store := datastore.NewStore(flags, fileService, connection)

	isNew, err := store.Open()
	if err != nil {
		log.Fatal().Err(err).Msg("failed opening store")
	}

	if *flags.Rollback {
		if err := store.Rollback(false); err != nil {
			log.Fatal().Err(err).Msg("failed rolling back")
		}

		log.Info().Msg("exiting rollback")
		os.Exit(0)
	}

	// Init sets some defaults - it's basically a migration
	if err := store.Init(); err != nil {
		log.Fatal().Err(err).Msg("failed initializing data store")
	}

	if isNew {
		instanceId, err := uuid.NewRandom()
		if err != nil {
			log.Fatal().Err(err).Msg("failed generating instance id")
		}

		migratorInstance := migrator.NewMigrator(&migrator.MigratorParameters{Flags: flags})
		migratorCount := migratorInstance.GetMigratorCountOfCurrentAPIVersion()

		// from MigrateData
		v := models.Version{
			SchemaVersion: portainer.APIVersion,
			Edition:       int(portainer.PortainerCE),
			InstanceID:    instanceId.String(),
			MigratorCount: migratorCount,
		}

		if err := store.VersionService.UpdateVersion(&v); err != nil {
			log.Fatal().Err(err).Msg("failed to update version")
		}

		if err := updateSettingsFromFlags(store, flags); err != nil {
			log.Fatal().Err(err).Msg("failed updating settings from flags")
		}
	} else if err := store.MigrateData(); err != nil {
		log.Fatal().Err(err).Msg("failed migration")
	}

	if err := updateSettingsFromFlags(store, flags); err != nil {
		log.Fatal().Err(err).Msg("failed updating settings from flags")
	}

	// close the database connection on shutdown
	go func() {
		<-shutdownCtx.Done()

		defer logs.CloseAndLogErr(connection)
	}()

	return store
}

// checkDBSchemaServerVersionMatch checks if the server version matches the db scehma version
func checkDBSchemaServerVersionMatch(dbStore dataservices.DataStore, serverVersion string, serverEdition int) bool {
	v, err := dbStore.Version().Version()
	if err != nil {
		return false
	}

	return v.SchemaVersion == serverVersion && v.Edition == serverEdition
}

func initDigitalSignatureService() portainer.DigitalSignatureService {
	return crypto.NewECDSAService(os.Getenv("AGENT_SECRET"))
}

func initSSLService(addr, certPath, keyPath string, fileService portainer.FileService, dataStore dataservices.DataStore, shutdownTrigger context.CancelFunc) (*ssl.Service, error) {
	slices := strings.Split(addr, ":")

	host := slices[0]
	if host == "" {
		host = "0.0.0.0"
	}

	sslService := ssl.NewService(fileService, dataStore, shutdownTrigger)

	if err := sslService.Init(host, certPath, keyPath); err != nil {
		return nil, err
	}

	return sslService, nil
}

func initSnapshotService(
	snapshotIntervalFromFlag string,
	dataStore dataservices.DataStore,
	dockerClientFactory *dockerclient.ClientFactory,
	kubernetesClientFactory *kubecli.ClientFactory,
) (portainer.SnapshotService, error) {
	dockerSnapshotter := docker.NewSnapshotter(dockerClientFactory)
	kubernetesSnapshotter := kubernetes.NewSnapshotter(kubernetesClientFactory)

	snapshotService, err := snapshot.NewService(snapshotIntervalFromFlag, dataStore, dockerSnapshotter, kubernetesSnapshotter)
	if err != nil {
		return nil, err
	}

	return snapshotService, nil
}

func initStatus(instanceID string) *portainer.Status {
	return &portainer.Status{
		Version:    portainer.APIVersion,
		InstanceID: instanceID,
	}
}

func updateSettingsFromFlags(dataStore dataservices.DataStore, flags *portainer.CLIFlags) error {
	settings, err := dataStore.Settings().Settings()
	if err != nil {
		return err
	}

	settings.SnapshotInterval = cmp.Or(*flags.SnapshotInterval, settings.SnapshotInterval)
	settings.LogoURL = cmp.Or(*flags.Logo, settings.LogoURL)
	settings.TemplatesURL = cmp.Or(*flags.Templates, settings.TemplatesURL)

	if *flags.Labels != nil {
		settings.BlackListedLabels = *flags.Labels
	}

	settings.AgentSecret = ""
	if agentKey, ok := os.LookupEnv("AGENT_SECRET"); ok {
		settings.AgentSecret = agentKey
	}

	if err := dataStore.Settings().UpdateSettings(settings); err != nil {
		return err
	}

	sslSettings, err := dataStore.SSLSettings().Settings()
	if err != nil {
		return err
	}

	if *flags.HTTPDisabled {
		sslSettings.HTTPEnabled = false
	} else if *flags.HTTPEnabled {
		sslSettings.HTTPEnabled = true
	}

	return dataStore.SSLSettings().UpdateSettings(sslSettings)
}

func loadAndParseKeyPair(fileService portainer.FileService, signatureService portainer.DigitalSignatureService) error {
	private, public, err := fileService.LoadKeyPair()
	if err != nil {
		return err
	}

	return signatureService.ParseKeyPair(private, public)
}

func generateAndStoreKeyPair(fileService portainer.FileService, signatureService portainer.DigitalSignatureService) error {
	private, public, err := signatureService.GenerateKeyPair()
	if err != nil {
		return err
	}

	privateHeader, publicHeader := signatureService.PEMHeaders()

	return fileService.StoreKeyPair(private, public, privateHeader, publicHeader)
}

func initKeyPair(fileService portainer.FileService, signatureService portainer.DigitalSignatureService) error {
	existingKeyPair, err := fileService.KeyPairFilesExist()
	if err != nil {
		log.Fatal().Err(err).Msg("failed checking for existing key pair")
	}

	if existingKeyPair {
		return loadAndParseKeyPair(fileService, signatureService)
	}

	return generateAndStoreKeyPair(fileService, signatureService)
}

// dbSecretPath build the path to the file that contains the db encryption
// secret. Normally in Docker this is built from the static path inside
// portainer.DefaultSecretsDir for example: /run/secrets/<keyFilenameFlag> but
// for ease of use outside Docker it also accepts an absolute path
func dbSecretPath(keyFilenameFlag string) string {
	if path.IsAbs(keyFilenameFlag) {
		return keyFilenameFlag
	}
	return filesystem.JoinPaths(portainer.DefaultSecretsDir, keyFilenameFlag)
}

func loadEncryptionSecretKey(keyfilename string) []byte {
	content, err := os.ReadFile(keyfilename)
	if err != nil {
		if os.IsNotExist(err) {
			log.Info().Str("filename", keyfilename).Msg("encryption key file not present")
		} else {
			log.Info().Err(err).Msg("error reading encryption key file")
		}

		return nil
	}

	// return a 32 byte hash of the secret (required for AES)
	// fips compliant version of this is not implemented in -ce
	hash := sha256.Sum256(content)

	return hash[:]
}

func buildServer(flags *portainer.CLIFlags, shutdownCtx context.Context, shutdownTrigger context.CancelFunc) portainer.Server {
	if flags.FeatureFlags != nil {
		featureflags.Parse(*flags.FeatureFlags, portainer.SupportedFeatureFlags)
	}

	trustedOrigins := []string{}
	if *flags.TrustedOrigins != "" {
		// validate if the trusted origins are valid urls
		for origin := range strings.SplitSeq(*flags.TrustedOrigins, ",") {
			if !validate.IsTrustedOrigin(origin) {
				log.Fatal().Str("trusted_origin", origin).Msg("invalid trusted origin: must be scheme://host or scheme://host:port (e.g. https://example.com)")
			}

			trustedOrigins = append(trustedOrigins, origin)
		}
	}

	// -ce can not ever be run in FIPS mode
	fips.InitFIPS(false)

	fileService := initFileService(*flags.Data)
	encryptionKey := loadEncryptionSecretKey(dbSecretPath(*flags.SecretKeyName))
	if encryptionKey == nil {
		log.Info().Msg("proceeding without encryption key")
	}

	dataStore := initDataStore(flags, encryptionKey, fileService, shutdownCtx)

	if err := dataStore.CheckCurrentEdition(); err != nil {
		log.Fatal().Err(err).Msg("")
	}

	// check if the db schema version matches with server version
	if !checkDBSchemaServerVersionMatch(dataStore, portainer.APIVersion, int(portainer.Edition)) {
		log.Fatal().Msg("The database schema version does not align with the server version. Please consider reverting to the previous server version or addressing the database migration issue.")
	}

	if err := ssrf.Configure(ssrf.DisabledPolicy{}); err != nil {
		log.Fatal().Err(err).Msg("failed initializing ssrf service")
	}

	if !ssrf.WrapDefaultTransport() {
		log.Fatal().Msg("failed to wrap default HTTP transport with SSRF protection")
	}

	git.InstallSSRFProtocols()

	instanceID, err := dataStore.Version().InstanceID()
	if err != nil {
		log.Fatal().Err(err).Msg("failed getting instance id")
	}

	settings, err := dataStore.Settings().Settings()
	if err != nil {
		log.Fatal().Err(err).Msg("")
	}

	gitService := git.NewService(shutdownCtx)

	cryptoService := crypto.Service{}

	signatureService := initDigitalSignatureService()

	sslService, err := initSSLService(*flags.AddrHTTPS, *flags.TLSCert, *flags.TLSKey, fileService, dataStore, shutdownTrigger)
	if err != nil {
		log.Fatal().Err(err).Msg("")
	}

	if err := initKeyPair(fileService, signatureService); err != nil {
		log.Fatal().Err(err).Msg("failed initializing key pair")
	}

	dockerClientFactory := dockerclient.NewClientFactory(signatureService)

	kubernetesClientFactory, err := kubecli.NewClientFactory(signatureService, dataStore, instanceID, *flags.AddrHTTPS, settings.UserSessionTimeout)
	if err != nil {
		log.Fatal().Err(err).Msg("failed initializing Kubernetes Client Factory service")
	}

	authorizationService := authorization.NewService(dataStore)
	authorizationService.K8sClientFactory = kubernetesClientFactory

	proxyManager := proxy.NewManager(kubernetesClientFactory)

	composeDeployer := compose.NewComposeDeployer()

	composeStackManager := exec.NewComposeStackManager(composeDeployer, proxyManager)

	// The post-init migrator keeps its Kubernetes deployer parameter
	// (BoltDB and migrator code stay unchanged) but never calls it; the
	// Kubernetes deployer is removed (TAI-016).
	var kubernetesDeployer portainer.KubernetesDeployer

	snapshotService, err := initSnapshotService(*flags.SnapshotInterval, dataStore, dockerClientFactory, kubernetesClientFactory)
	if err != nil {
		log.Fatal().Err(err).Msg("failed initializing snapshot service")
	}

	snapshotService.Start(shutdownCtx)

	proxyManager.NewProxyFactory(dataStore, signatureService, dockerClientFactory, gitService, snapshotService)

	applicationStatus := initStatus(instanceID)

	// There is no first-administrator setup (TAI-001): store the local
	// operator right away, then create the environment given with -H.
	if err := dataStore.UpdateTx(func(tx dataservices.DataStoreTx) error {
		created, err := security.EnsureLocalOperator(tx)
		if created {
			log.Info().Msg("created the local operator record")
		}

		return err
	}); err != nil {
		log.Fatal().Err(err).Msg("failed creating the local operator record")
	}

	localOperatorReady := make(chan struct{}, 1)
	localOperatorReady <- struct{}{}

	go endpointutils.InitEndpoint(shutdownCtx, localOperatorReady, flags, dataStore, snapshotService)

	sched := scheduler.NewScheduler(shutdownCtx)
	stackDeployer := deployments.NewStackDeployer(composeStackManager, dockerClientFactory, dataStore)
	sourceScheduler := scheduling.NewSourceScheduler(sched, dataStore, scheduling.Deployers{
		Stack: func(ctx context.Context, stackID portainer.StackID) error {
			return deployments.RedeployWhenChanged(ctx, stackID, stackDeployer, dataStore, gitService, fileService)
		},
		StackExists: dataStore.Stack().Exists,
		EdgeStackExists: func(edgeStackID portainer.EdgeStackID) (bool, error) {
			_, err := dataStore.EdgeStack().EdgeStack(edgeStackID)
			if dataservices.IsErrObjectNotFound(err) {
				return false, nil
			}

			return err == nil, err
		},
	})
	if err := sourceScheduler.ReconcileAll(); err != nil {
		log.Fatal().Err(err).Msg("failed to start source scheduler")
	}

	sslDBSettings, err := dataStore.SSLSettings().Settings()
	if err != nil {
		log.Fatal().Msg("failed to fetch SSL settings from DB")
	}

	platformService := platform.NewService(dataStore)

	// Our normal migrations run as part of the database initialization
	// but some more complex migrations require access to a kubernetes or docker
	// client. Therefore we run a separate migration process just before
	// starting the server.
	postInitMigrator := postinit.NewPostInitMigrator(
		kubernetesClientFactory,
		dockerClientFactory,
		dataStore,
		*flags.Assets,
		kubernetesDeployer,
	)
	if err := postInitMigrator.PostInitMigrate(); err != nil {
		log.Fatal().Err(err).Msg("failure during post init migrations")
	}

	if err := dataStore.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return recoverStaleDeployingStacks(tx)
	}); err != nil {
		log.Info().Err(err).
			Msg("Error recovering stale deploying stacks")
	}

	return &http.Server{
		AuthorizationService:    authorizationService,
		Status:                  applicationStatus,
		BindAddress:             *flags.Addr,
		BindAddressHTTPS:        *flags.AddrHTTPS,
		CSP:                     *flags.CSP,
		HTTPEnabled:             sslDBSettings.HTTPEnabled,
		AssetsPath:              *flags.Assets,
		DataStore:               dataStore,
		ComposeStackManager:     composeStackManager,
		CryptoService:           cryptoService,
		FileService:             fileService,
		GitService:              gitService,
		ProxyManager:            proxyManager,
		SignatureService:        signatureService,
		SnapshotService:         snapshotService,
		SSLService:              sslService,
		DockerClientFactory:     dockerClientFactory,
		KubernetesClientFactory: kubernetesClientFactory,
		SourceScheduler:         sourceScheduler,
		StackDeployer:           stackDeployer,
		PlatformService:         platformService,
		TrustedOrigins:          trustedOrigins,
	}
}

func main() {
	logs.ConfigureLogger()
	logs.SetLoggingMode("PRETTY")

	flags := initCLI()

	logs.SetLoggingLevel(*flags.LogLevel)
	logs.SetLoggingMode(*flags.LogMode)

	for {
		shutdownCtx, shutdownTrigger := context.WithCancel(context.Background())
		server := buildServer(flags, shutdownCtx, shutdownTrigger)

		log.Info().
			Str("version", portainer.APIVersion).
			Str("build_number", build.BuildNumber).
			Str("image_tag", build.ImageTag).
			Str("nodejs_version", build.NodejsVersion).
			Str("pnpm_version", build.PnpmVersion).
			Str("webpack_version", build.WebpackVersion).
			Str("go_version", build.GoVersion).
			Msg("starting Portainer")

		err := server.Start(shutdownCtx)

		log.Info().Err(err).Msg("HTTP server exited")
	}
}

// recoverStaleDeployingStacks resets any stack that was left in the Deploying state
// (e.g. because the server was restarted mid-deployment) to the Error state so the
// user can retry.
func recoverStaleDeployingStacks(tx dataservices.DataStoreTx) error {
	stacks, err := tx.Stack().ReadAll(func(s portainer.Stack) bool {
		return s.Status == portainer.StackStatusDeploying
	})
	if err != nil {
		return err
	}

	for _, stack := range stacks {
		stack.Status = portainer.StackStatusError
		stack.DeploymentStatus = append(stack.DeploymentStatus, portainer.StackDeploymentStatus{
			Status:  portainer.StackStatusError,
			Time:    time.Now().Unix(),
			Message: "Deployment interrupted by server restart",
		})

		if err := tx.Stack().Update(stack.ID, &stack); err != nil {
			log.Warn().Err(err).
				Int("stack_id", int(stack.ID)).
				Str("context", "RecoverStaleDeployingStacks").
				Msg("Unable to recover stale deploying stack")
			continue
		}
		log.Debug().
			Int("stack_id", int(stack.ID)).
			Str("stack_name", stack.Name).
			Str("context", "RecoverStaleDeployingStacks").
			Msg("Recovered stale deploying stack to error state")
	}

	return nil
}
