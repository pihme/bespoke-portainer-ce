package main

import (
	"context"
	"net"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/database/models"
	"github.com/portainer/portainer/api/datastore"
	dockerclient "github.com/portainer/portainer/api/docker/client"
	"github.com/portainer/portainer/api/filesystem"
	http "github.com/portainer/portainer/api/http"
	"github.com/portainer/portainer/api/internal/testhelpers"
	kubecli "github.com/portainer/portainer/api/kubernetes/cli"
	"github.com/portainer/portainer/api/pendingactions"
	"github.com/portainer/portainer/pkg/libcrypto"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// localDockerStartupFlags builds CLI flags for a single-user local Docker daemon
// startup: bind address, data path, snapshot interval, TLS paths left empty so
// Portainer generates a self-signed certificate under the data directory.
func localDockerStartupFlags(dataDir string) *portainer.CLIFlags {
	addr := ":9000"
	addrHTTPS := ":9443"
	empty := ""
	compactDB := false
	rollback := false
	maxBatchSize := 1000
	maxBatchDelay := 20 * time.Millisecond
	initialMmapSize := 0
	labels := []portainer.Pair{}
	kubectl := portainer.DefaultKubectlShellImage
	snapshot := "5m"
	logo := ""
	templates := ""
	edgeURL := ""
	edgeEnabled := false
	trustOnFirst := false
	httpDisabled := false
	httpEnabled := false
	secretKeyName := "portainer"

	return &portainer.CLIFlags{
		Addr:                      &addr,
		AddrHTTPS:                 &addrHTTPS,
		Data:                      &dataDir,
		Assets:                    &empty,
		SnapshotInterval:          &snapshot,
		Logo:                      &logo,
		Templates:                 &templates,
		EnableEdgeComputeFeatures: &edgeEnabled,
		EdgePortainerURL:          &edgeURL,
		EdgeTrustOnFirstConnect:   &trustOnFirst,
		Labels:                    &labels,
		HTTPDisabled:              &httpDisabled,
		HTTPEnabled:               &httpEnabled,
		KubectlShellImage:         &kubectl,
		SecretKeyName:             &secretKeyName,
		CompactDB:                 &compactDB,
		Rollback:                  &rollback,
		MaxBatchSize:              &maxBatchSize,
		MaxBatchDelay:             &maxBatchDelay,
		InitialMmapSize:           &initialMmapSize,
		TLSCert:                   &empty,
		TLSKey:                    &empty,
	}
}

func freeTCPPort(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer ln.Close()
	return strconv.Itoa(ln.Addr().(*net.TCPAddr).Port)
}

func TestREQ_SRV_04_UpdateSettingsFromFlags_LocalDockerCLI(t *testing.T) {

	empty := ""
	falseBool := false
	trueBool := true
	labels := []portainer.Pair{{Name: "com.example.hide", Value: "1"}}
	snapshot := "10m"
	logo := "https://example.com/logo.png"
	templates := "https://example.com/templates.json"
	kubectl := portainer.DefaultKubectlShellImage

	t.Run("applies logo templates snapshot labels and http-disabled", func(t *testing.T) {
		store := testhelpers.NewDatastore(
			testhelpers.WithSettingsService(&portainer.Settings{
				SnapshotInterval: "5m",
				LogoURL:          "old-logo",
				TemplatesURL:     "old-templates",
			}),
			testhelpers.WithSSLSettingsService(&portainer.SSLSettings{HTTPEnabled: true}),
		)

		flags := &portainer.CLIFlags{
			SnapshotInterval:          &snapshot,
			Logo:                      &logo,
			Templates:                 &templates,
			EnableEdgeComputeFeatures: &falseBool,
			EdgePortainerURL:          &empty,
			EdgeTrustOnFirstConnect:   &falseBool,
			Labels:                    &labels,
			HTTPDisabled:              &trueBool,
			HTTPEnabled:               &falseBool,
			KubectlShellImage:         &kubectl,
		}

		require.NoError(t, updateSettingsFromFlags(store, flags))

		settings, err := store.Settings().Settings()
		require.NoError(t, err)
		assert.Equal(t, snapshot, settings.SnapshotInterval)
		assert.Equal(t, logo, settings.LogoURL)
		assert.Equal(t, templates, settings.TemplatesURL)
		assert.Equal(t, labels, settings.BlackListedLabels)

		sslSettings, err := store.SSLSettings().Settings()
		require.NoError(t, err)
		assert.False(t, sslSettings.HTTPEnabled)
	})

	t.Run("http-enabled turns HTTP back on", func(t *testing.T) {
		store := testhelpers.NewDatastore(
			testhelpers.WithSettingsService(&portainer.Settings{}),
			testhelpers.WithSSLSettingsService(&portainer.SSLSettings{HTTPEnabled: false}),
		)

		flags := &portainer.CLIFlags{
			SnapshotInterval:          &empty,
			Logo:                      &empty,
			Templates:                 &empty,
			EnableEdgeComputeFeatures: &falseBool,
			EdgePortainerURL:          &empty,
			EdgeTrustOnFirstConnect:   &falseBool,
			Labels:                    &[]portainer.Pair{},
			HTTPDisabled:              &falseBool,
			HTTPEnabled:               &trueBool,
			KubectlShellImage:         &kubectl,
		}

		require.NoError(t, updateSettingsFromFlags(store, flags))

		sslSettings, err := store.SSLSettings().Settings()
		require.NoError(t, err)
		assert.True(t, sslSettings.HTTPEnabled)
	})

	t.Run("AGENT_SECRET env populates settings", func(t *testing.T) {
		t.Setenv("AGENT_SECRET", "local-docker-agent-secret")

		store := testhelpers.NewDatastore(
			testhelpers.WithSettingsService(&portainer.Settings{}),
			testhelpers.WithSSLSettingsService(&portainer.SSLSettings{}),
		)

		flags := &portainer.CLIFlags{
			SnapshotInterval:          &empty,
			Logo:                      &empty,
			Templates:                 &empty,
			EnableEdgeComputeFeatures: &falseBool,
			EdgePortainerURL:          &empty,
			EdgeTrustOnFirstConnect:   &falseBool,
			Labels:                    &[]portainer.Pair{},
			HTTPDisabled:              &falseBool,
			HTTPEnabled:               &falseBool,
			KubectlShellImage:         &kubectl,
		}

		require.NoError(t, updateSettingsFromFlags(store, flags))

		settings, err := store.Settings().Settings()
		require.NoError(t, err)
		assert.Equal(t, "local-docker-agent-secret", settings.AgentSecret)
	})
}

func TestREQ_SRV_01_InitFileService_DataPath(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	fs := initFileService(dataDir)
	require.NotNil(t, fs)

	exists, err := fs.KeyPairFilesExist()
	require.NoError(t, err)
	assert.False(t, exists)
}

func TestREQ_SRV_01_InitStatus_InstanceID(t *testing.T) {
	t.Parallel()

	status := initStatus("local-instance-id")
	require.NotNil(t, status)
	assert.Equal(t, portainer.APIVersion, status.Version)
	assert.Equal(t, "local-instance-id", status.InstanceID)
}

func TestREQ_SRV_01_InitDigitalSignatureAndAPIKeyAndJWT(t *testing.T) {
	t.Parallel()

	sig := initDigitalSignatureService()
	require.NotNil(t, sig)

	_, store := datastore.MustNewTestStore(t, true, false)

	apiKeys := initAPIKeyService(store)
	require.NotNil(t, apiKeys)

	jwtDefault, err := initJWTService("", store)
	require.NoError(t, err)
	require.NotNil(t, jwtDefault)

	jwtCustom, err := initJWTService("1h", store)
	require.NoError(t, err)
	require.NotNil(t, jwtCustom)
}

func TestREQ_SRV_01_CheckDBSchemaServerVersionMatch(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)

	assert.True(t, checkDBSchemaServerVersionMatch(store, portainer.APIVersion, int(portainer.PortainerCE)))
	assert.False(t, checkDBSchemaServerVersionMatch(store, "0.0.0", int(portainer.PortainerCE)))
	assert.False(t, checkDBSchemaServerVersionMatch(store, portainer.APIVersion, 99))

	require.NoError(t, store.Version().UpdateVersion(&models.Version{
		SchemaVersion: "9.9.9",
		Edition:       int(portainer.PortainerCE),
	}))
	assert.False(t, checkDBSchemaServerVersionMatch(store, portainer.APIVersion, int(portainer.PortainerCE)))
}

func TestREQ_SRV_05_InitSSLService_BindHTTPSAndTLSPaths(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)

	t.Run("empty host defaults to 0.0.0.0 and self-signed cert", func(t *testing.T) {
		svc, err := initSSLService(":9443", "", "", fs, store, func() {})
		require.NoError(t, err)
		require.NotNil(t, svc)

		settings, err := svc.GetSSLSettings()
		require.NoError(t, err)
		assert.NotEmpty(t, settings.CertPath)
		assert.NotEmpty(t, settings.KeyPath)
		assert.True(t, settings.SelfSigned)
		assert.FileExists(t, settings.CertPath)
		assert.FileExists(t, settings.KeyPath)
	})

	t.Run("supplied TLS cert and key paths are copied", func(t *testing.T) {
		certDir := t.TempDir()
		certPath := filepath.Join(certDir, "cert.pem")
		keyPath := filepath.Join(certDir, "key.pem")
		require.NoError(t, libcrypto.GenerateCertsForHost("localhost", "127.0.0.1", certPath, keyPath, time.Now().AddDate(1, 0, 0)))

		fs2, err := filesystem.NewService(t.TempDir(), "")
		require.NoError(t, err)

		svc, err := initSSLService("127.0.0.1:9443", certPath, keyPath, fs2, store, func() {})
		require.NoError(t, err)
		require.NotNil(t, svc)

		settings, err := svc.GetSSLSettings()
		require.NoError(t, err)
		assert.NotEmpty(t, settings.CertPath)
		assert.NotEmpty(t, settings.KeyPath)
		assert.False(t, settings.SelfSigned)
	})
}

func TestREQ_SRV_01_InitKeyPair_GenerateAndReload(t *testing.T) {
	t.Parallel()

	dataDir := t.TempDir()
	fs, err := filesystem.NewService(dataDir, "")
	require.NoError(t, err)
	sig := initDigitalSignatureService()

	require.NoError(t, initKeyPair(fs, sig))

	exists, err := fs.KeyPairFilesExist()
	require.NoError(t, err)
	assert.True(t, exists)

	sig2 := initDigitalSignatureService()
	require.NoError(t, initKeyPair(fs, sig2))
}

func TestREQ_DED_04_InitSnapshotService_LocalInterval(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	sig := initDigitalSignatureService()
	dockerFactory := dockerclient.NewClientFactory(sig, nil)

	k8sFactory, err := kubecli.NewClientFactory(sig, nil, store, "test-instance", ":9443", portainer.DefaultUserSessionTimeout)
	require.NoError(t, err)

	pending := pendingactions.NewService(store, k8sFactory)
	svc, err := initSnapshotService("5m", store, dockerFactory, k8sFactory, pending)
	require.NoError(t, err)
	require.NotNil(t, svc)
}

func TestREQ_SRV_01_InitDataStore_NewLocalDataPath(t *testing.T) {
	dataDir := t.TempDir()
	flags := localDockerStartupFlags(dataDir)
	fs, err := filesystem.NewService(dataDir, "")
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	store := initDataStore(flags, nil, fs, ctx)
	require.NotNil(t, store)

	v, err := store.Version().Version()
	require.NoError(t, err)
	assert.Equal(t, portainer.APIVersion, v.SchemaVersion)
	assert.Equal(t, int(portainer.PortainerCE), v.Edition)
	assert.NotEmpty(t, v.InstanceID)

	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	assert.Equal(t, "5m", settings.SnapshotInterval)

	cancel()
	require.NoError(t, store.Close())
}

func TestREQ_SRV_01_InitDataStore_ExistingLocalDataPath(t *testing.T) {
	dataDir := t.TempDir()
	flags := localDockerStartupFlags(dataDir)
	fs, err := filesystem.NewService(dataDir, "")
	require.NoError(t, err)

	ctx1, cancel1 := context.WithCancel(context.Background())
	store1 := initDataStore(flags, nil, fs, ctx1)
	require.NotNil(t, store1)
	instanceBefore, err := store1.Version().InstanceID()
	require.NoError(t, err)
	cancel1()
	require.NoError(t, store1.Close())

	// Give the shutdown goroutine a moment to release the bolt lock.
	time.Sleep(50 * time.Millisecond)

	fs2, err := filesystem.NewService(dataDir, "")
	require.NoError(t, err)
	ctx2, cancel2 := context.WithCancel(context.Background())
	defer cancel2()

	store2 := initDataStore(flags, nil, fs2, ctx2)
	require.NotNil(t, store2)
	instanceAfter, err := store2.Version().InstanceID()
	require.NoError(t, err)
	assert.Equal(t, instanceBefore, instanceAfter)

	cancel2()
	require.NoError(t, store2.Close())
}

func TestREQ_SRV_01_RecoverStaleDeployingStacks_LocalCompose(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)

	deploying := &portainer.Stack{
		ID:         1,
		Name:       "local-compose",
		Type:       portainer.DockerComposeStack,
		EndpointID: 1,
		Status:     portainer.StackStatusDeploying,
	}
	active := &portainer.Stack{
		ID:         2,
		Name:       "already-active",
		Type:       portainer.DockerComposeStack,
		EndpointID: 1,
		Status:     portainer.StackStatusActive,
	}
	require.NoError(t, store.Stack().Create(deploying))
	require.NoError(t, store.Stack().Create(active))

	require.NoError(t, recoverStaleDeployingStacks(store))

	gotDeploying, err := store.Stack().Read(deploying.ID)
	require.NoError(t, err)
	assert.Equal(t, portainer.StackStatusError, gotDeploying.Status)
	require.NotEmpty(t, gotDeploying.DeploymentStatus)
	assert.Equal(t, portainer.StackStatusError, gotDeploying.DeploymentStatus[len(gotDeploying.DeploymentStatus)-1].Status)
	assert.Contains(t, gotDeploying.DeploymentStatus[len(gotDeploying.DeploymentStatus)-1].Message, "server restart")

	gotActive, err := store.Stack().Read(active.ID)
	require.NoError(t, err)
	assert.Equal(t, portainer.StackStatusActive, gotActive.Status)
}

func TestREQ_SRV_01_InitDataStore_RespectsLogoAndHTTPFlags(t *testing.T) {
	dataDir := t.TempDir()
	flags := localDockerStartupFlags(dataDir)
	logo := "https://cdn.example.com/portainer.png"
	flags.Logo = &logo
	httpDisabled := true
	flags.HTTPDisabled = &httpDisabled

	fs, err := filesystem.NewService(dataDir, "")
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	store := initDataStore(flags, nil, fs, ctx)
	require.NotNil(t, store)

	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	assert.Equal(t, logo, settings.LogoURL)

	sslSettings, err := store.SSLSettings().Settings()
	require.NoError(t, err)
	assert.False(t, sslSettings.HTTPEnabled)

	cancel()
	require.NoError(t, store.Close())
}

func TestREQ_SRV_01_BuildServer_LocalDockerDaemonStartup(t *testing.T) {
	dataDir := t.TempDir()
	flags := localDockerStartupFlags(dataDir)

	tunnelAddr := "127.0.0.1"
	tunnelPort := freeTCPPort(t)
	assets := t.TempDir()
	baseURL := "/"
	trustedOrigins := ""
	adminPassword := ""
	adminPasswordFile := ""
	noSetupToken := true
	csp := true
	pullLimitDisabled := true
	endpointURL := ""
	featureFlags := []string{}

	flags.TunnelAddr = &tunnelAddr
	flags.TunnelPort = &tunnelPort
	flags.Assets = &assets
	flags.BaseURL = &baseURL
	flags.TrustedOrigins = &trustedOrigins
	flags.AdminPassword = &adminPassword
	flags.AdminPasswordFile = &adminPasswordFile
	flags.NoSetupToken = &noSetupToken
	flags.CSP = &csp
	flags.PullLimitCheckDisabled = &pullLimitDisabled
	flags.EndpointURL = &endpointURL
	flags.FeatureFlags = &featureFlags
	setupToken := ""
	flags.SetupToken = &setupToken

	bind := "127.0.0.1:" + freeTCPPort(t)
	bindHTTPS := "127.0.0.1:" + freeTCPPort(t)
	flags.Addr = &bind
	flags.AddrHTTPS = &bindHTTPS

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	server := buildServer(flags, ctx, cancel)
	require.NotNil(t, server)

	httpServer, ok := server.(*http.Server)
	require.True(t, ok)
	assert.Equal(t, bind, httpServer.BindAddress)
	assert.Equal(t, bindHTTPS, httpServer.BindAddressHTTPS)
	assert.Equal(t, assets, httpServer.AssetsPath)
	assert.True(t, httpServer.PullLimitCheckDisabled)
	require.NotNil(t, httpServer.DataStore)
	require.NotNil(t, httpServer.SnapshotService)
	require.NotNil(t, httpServer.SSLService)
	require.NotNil(t, httpServer.DockerClientFactory)
	require.NotNil(t, httpServer.ComposeStackManager)

	if httpServer.ReverseTunnelService != nil {
		_ = httpServer.ReverseTunnelService.StopTunnelServer()
	}
	cancel()
	if httpServer.DataStore != nil {
		_ = httpServer.DataStore.Close()
	}
}

func TestREQ_SRV_04_BuildServer_TrustedOriginsLocalBind(t *testing.T) {
	dataDir := t.TempDir()
	flags := localDockerStartupFlags(dataDir)

	tunnelAddr := "127.0.0.1"
	tunnelPort := freeTCPPort(t)
	assets := t.TempDir()
	baseURL := "/"
	trustedOrigins := "https://portainer.example.com,https://ui.example.com:8443"
	adminPassword := ""
	adminPasswordFile := ""
	noSetupToken := true
	csp := true
	pullLimitDisabled := true
	endpointURL := ""
	featureFlags := []string{}
	setupToken := ""

	flags.TunnelAddr = &tunnelAddr
	flags.TunnelPort = &tunnelPort
	flags.Assets = &assets
	flags.BaseURL = &baseURL
	flags.TrustedOrigins = &trustedOrigins
	flags.AdminPassword = &adminPassword
	flags.AdminPasswordFile = &adminPasswordFile
	flags.NoSetupToken = &noSetupToken
	flags.CSP = &csp
	flags.PullLimitCheckDisabled = &pullLimitDisabled
	flags.EndpointURL = &endpointURL
	flags.FeatureFlags = &featureFlags
	flags.SetupToken = &setupToken

	bind := "127.0.0.1:" + freeTCPPort(t)
	bindHTTPS := "127.0.0.1:" + freeTCPPort(t)
	flags.Addr = &bind
	flags.AddrHTTPS = &bindHTTPS

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	server := buildServer(flags, ctx, cancel)
	require.NotNil(t, server)

	httpServer, ok := server.(*http.Server)
	require.True(t, ok)
	assert.Equal(t, []string{"https://portainer.example.com", "https://ui.example.com:8443"}, httpServer.TrustedOrigins)

	if httpServer.ReverseTunnelService != nil {
		_ = httpServer.ReverseTunnelService.StopTunnelServer()
	}
	cancel()
	if httpServer.DataStore != nil {
		_ = httpServer.DataStore.Close()
	}
}
