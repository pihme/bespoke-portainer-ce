package http

import (
	"context"
	"crypto/tls"
	"net/http"
	"time"

	"github.com/pkg/errors"
	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/crypto"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/docker"
	dockerclient "github.com/portainer/portainer/api/docker/client"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/gitops/scheduling"
	"github.com/portainer/portainer/api/http/csrf"
	"github.com/portainer/portainer/api/http/handler"
	"github.com/portainer/portainer/api/http/handler/customtemplates"
	dockerhandler "github.com/portainer/portainer/api/http/handler/docker"
	"github.com/portainer/portainer/api/http/handler/endpointproxy"
	"github.com/portainer/portainer/api/http/handler/endpoints"
	"github.com/portainer/portainer/api/http/handler/file"
	"github.com/portainer/portainer/api/http/handler/gitops"
	"github.com/portainer/portainer/api/http/handler/settings"
	sslhandler "github.com/portainer/portainer/api/http/handler/ssl"
	"github.com/portainer/portainer/api/http/handler/stacks"
	"github.com/portainer/portainer/api/http/handler/storybook"
	"github.com/portainer/portainer/api/http/handler/system"
	"github.com/portainer/portainer/api/http/handler/templates"
	"github.com/portainer/portainer/api/http/handler/upload"
	"github.com/portainer/portainer/api/http/handler/users"
	"github.com/portainer/portainer/api/http/handler/websocket"
	"github.com/portainer/portainer/api/http/middlewares"
	"github.com/portainer/portainer/api/http/proxy"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/authorization"
	"github.com/portainer/portainer/api/internal/ssl"
	"github.com/portainer/portainer/api/platform"
	"github.com/portainer/portainer/api/stacks/deployments"
	"github.com/portainer/portainer/api/stacks/teardown"

	"github.com/rs/zerolog/log"
)

// Server implements the portainer.Server interface
type Server struct {
	AuthorizationService *authorization.Service
	BindAddress          string
	BindAddressHTTPS     string
	CSP                  bool
	HTTPEnabled          bool
	AssetsPath           string
	Status               *portainer.Status
	ComposeStackManager  portainer.ComposeStackManager
	CryptoService        portainer.CryptoService
	SignatureService     portainer.DigitalSignatureService
	SnapshotService      portainer.SnapshotService
	FileService          portainer.FileService
	DataStore            dataservices.DataStore
	GitService           portainer.GitService
	ProxyManager         *proxy.Manager
	Handler              *handler.Handler
	SSLService           *ssl.Service
	DockerClientFactory  *dockerclient.ClientFactory
	SourceScheduler      *scheduling.SourceScheduler
	StackDeployer        deployments.StackDeployer
	PlatformService      platform.Service
	TrustedOrigins       []string
}

// Start starts the HTTP server
func (server *Server) Start(ctx context.Context) error {
	requestBouncer := security.NewRequestBouncer(ctx, server.DataStore)
	if !server.CSP {
		requestBouncer.DisableCSP()
	}

	var customTemplatesHandler = customtemplates.NewHandler(requestBouncer, server.DataStore, server.FileService, server.GitService)

	var endpointHandler = endpoints.NewHandler(requestBouncer)
	endpointHandler.DataStore = server.DataStore
	endpointHandler.FileService = server.FileService
	endpointHandler.ProxyManager = server.ProxyManager
	endpointHandler.SnapshotService = server.SnapshotService
	endpointHandler.DockerClientFactory = server.DockerClientFactory
	endpointHandler.ComposeStackManager = server.ComposeStackManager
	endpointHandler.AuthorizationService = server.AuthorizationService
	endpointHandler.BindAddress = server.BindAddress
	endpointHandler.BindAddressHTTPS = server.BindAddressHTTPS

	var endpointProxyHandler = endpointproxy.NewHandler(requestBouncer)
	endpointProxyHandler.DataStore = server.DataStore
	endpointProxyHandler.ProxyManager = server.ProxyManager

	containerService := docker.NewContainerService(server.DockerClientFactory, server.DataStore)

	var dockerHandler = dockerhandler.NewHandler(requestBouncer, server.AuthorizationService, server.DataStore, server.DockerClientFactory, containerService)

	var fileHandler = file.NewHandler(filesystem.JoinPaths(server.AssetsPath, "public"), server.CSP)

	var gitOperationHandler = gitops.NewHandler(requestBouncer, server.DataStore, server.GitService, server.FileService, server.SourceScheduler)

	var settingsHandler = settings.NewHandler(requestBouncer)
	settingsHandler.DataStore = server.DataStore
	settingsHandler.FileService = server.FileService
	settingsHandler.SnapshotService = server.SnapshotService

	var sslHandler = sslhandler.NewHandler(requestBouncer)
	sslHandler.SSLService = server.SSLService

	teardownService := teardown.NewService(server.FileService, server.ComposeStackManager, server.StackDeployer)
	var stackHandler = stacks.NewHandler(requestBouncer, teardownService)
	stackHandler.DataStore = server.DataStore
	stackHandler.DockerClientFactory = server.DockerClientFactory
	stackHandler.FileService = server.FileService
	stackHandler.GitService = server.GitService
	stackHandler.SourceScheduler = server.SourceScheduler
	stackHandler.ComposeStackManager = server.ComposeStackManager
	stackHandler.StackDeployer = server.StackDeployer

	var storybookHandler = storybook.NewHandler(server.AssetsPath)

	var systemHandler = system.NewHandler(requestBouncer,
		server.Status,
		server.DataStore,
		server.PlatformService)

	var templatesHandler = templates.NewHandler(requestBouncer)
	templatesHandler.DataStore = server.DataStore
	templatesHandler.FileService = server.FileService
	templatesHandler.GitService = server.GitService

	var uploadHandler = upload.NewHandler(requestBouncer)
	uploadHandler.FileService = server.FileService

	var userHandler = users.NewHandler(requestBouncer)
	userHandler.DataStore = server.DataStore

	var websocketHandler = websocket.NewHandler(requestBouncer)
	websocketHandler.DataStore = server.DataStore

	server.Handler = &handler.Handler{
		CustomTemplatesHandler: customTemplatesHandler,
		DockerHandler:          dockerHandler,
		EndpointHandler:        endpointHandler,
		EndpointProxyHandler:   endpointProxyHandler,
		GitOperationHandler:    gitOperationHandler,
		FileHandler:            fileHandler,
		SettingsHandler:        settingsHandler,
		SSLHandler:             sslHandler,
		StackHandler:           stackHandler,
		StorybookHandler:       storybookHandler,
		SystemHandler:          systemHandler,
		TemplatesHandler:       templatesHandler,
		UploadHandler:          uploadHandler,
		UserHandler:            userHandler,
		WebSocketHandler:       websocketHandler,
	}

	errorLogger := NewHTTPLogger()

	var handler http.Handler = server.Handler

	handler = middlewares.WithPanicLogger(middlewares.WithSlowRequestsLogger(handler))

	handler, err := csrf.WithProtect(handler, server.TrustedOrigins)
	if err != nil {
		return errors.Wrap(err, "failed to create CSRF middleware")
	}

	if server.HTTPEnabled {
		go func() {
			log.Info().Str("bind_address", server.BindAddress).Msg("starting HTTP server")
			httpServer := &http.Server{
				Addr:     server.BindAddress,
				Handler:  handler,
				ErrorLog: errorLogger,
			}

			go shutdown(ctx, httpServer)

			err := httpServer.ListenAndServe()
			if err != nil && err != http.ErrServerClosed {
				log.Error().Err(err).Msg("HTTP server failed to start")
			}
		}()
	}

	log.Info().Str("bind_address", server.BindAddressHTTPS).Msg("starting HTTPS server")
	httpsServer := &http.Server{
		Addr:         server.BindAddressHTTPS,
		Handler:      handler,
		ErrorLog:     errorLogger,
		TLSNextProto: make(map[string]func(*http.Server, *tls.Conn, http.Handler)), // Disable HTTP/2
	}

	httpsServer.TLSConfig = crypto.CreateTLSConfiguration(false)
	httpsServer.TLSConfig.GetCertificate = func(*tls.ClientHelloInfo) (*tls.Certificate, error) {
		return server.SSLService.GetRawCertificate(), nil
	}

	go shutdown(ctx, httpsServer)

	return httpsServer.ListenAndServeTLS("", "")
}

func shutdown(shutdownCtx context.Context, httpServer *http.Server) {
	<-shutdownCtx.Done()

	log.Debug().Msg("shutting down the HTTP server")
	shutdownTimeout, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	err := httpServer.Shutdown(shutdownTimeout)
	if err != nil {
		log.Error().
			Err(err).
			Msg("failed to shut down the HTTP server")
	}
}
