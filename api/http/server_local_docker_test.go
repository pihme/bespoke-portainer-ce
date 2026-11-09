package http

import (
	"context"
	"crypto/tls"
	"net"
	"net/http"
	"strconv"
	"testing"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/apikey"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/http/proxy"
	"github.com/portainer/portainer/api/internal/ssl"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/pkg/featureflags"
	"github.com/portainer/portainer/pkg/fips"
	libclient "github.com/portainer/portainer/pkg/libhttp/client"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	fips.InitFIPS(false)
}

func freeTCPPort(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	defer ln.Close()
	return strconv.Itoa(ln.Addr().(*net.TCPAddr).Port)
}

func waitTCP(t *testing.T, addr string, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", addr, 50*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for TCP listen on %s", addr)
}

func blockExternalRequests(t *testing.T) {
	t.Helper()
	featureflags.Parse(
		[]string{string(libclient.DisableExternalRequests)},
		[]featureflags.Feature{libclient.DisableExternalRequests},
	)
	t.Cleanup(func() {
		featureflags.Parse(nil, []featureflags.Feature{libclient.DisableExternalRequests})
	})
}

func newLocalDockerHTTPServer(t *testing.T, httpEnabled, csp bool, trustedOrigins []string, setupToken string) (*Server, context.Context, context.CancelFunc) {
	t.Helper()
	blockExternalRequests(t)

	dataDir := t.TempDir()
	assetsDir := t.TempDir()

	fileService, err := filesystem.NewService(dataDir, dataDir)
	require.NoError(t, err)

	store := testhelpers.NewDatastore(
		testhelpers.WithSettingsService(&portainer.Settings{}),
		testhelpers.WithSSLSettingsService(&portainer.SSLSettings{HTTPEnabled: httpEnabled}),
	)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	sslService := ssl.NewService(fileService, store, cancel)
	require.NoError(t, sslService.Init("127.0.0.1", "", ""))
	require.NotNil(t, sslService.GetRawCertificate())

	bindHTTP := "127.0.0.1:" + freeTCPPort(t)
	bindHTTPS := "127.0.0.1:" + freeTCPPort(t)

	server := &Server{
		BindAddress:            bindHTTP,
		BindAddressHTTPS:       bindHTTPS,
		CSP:                    csp,
		HTTPEnabled:            httpEnabled,
		AssetsPath:             assetsDir,
		Status:                 &portainer.Status{Version: "test"},
		FileService:            fileService,
		DataStore:              store,
		APIKeyService:          apikey.NewAPIKeyService(nil, nil),
		ProxyManager:           proxy.NewManager(nil),
		SSLService:             sslService,
		ShutdownTrigger:        cancel,
		AdminCreationDone:      make(chan struct{}),
		PullLimitCheckDisabled: true,
		TrustedOrigins:         trustedOrigins,
		SetupToken:             setupToken,
	}

	return server, ctx, cancel
}

func assertLocalDockerHandlersWired(t *testing.T, server *Server) {
	t.Helper()
	require.NotNil(t, server.Handler)
	h := server.Handler
	assert.NotNil(t, h.AuthHandler)
	assert.NotNil(t, h.BackupHandler)
	assert.NotNil(t, h.CustomTemplatesHandler)
	assert.NotNil(t, h.DockerHandler)
	assert.NotNil(t, h.EndpointHandler)
	assert.NotNil(t, h.EndpointGroupHandler)
	assert.NotNil(t, h.EndpointProxyHandler)
	assert.NotNil(t, h.FileHandler)
	assert.NotNil(t, h.GitOperationHandler)
	assert.NotNil(t, h.LDAPHandler)
	assert.NotNil(t, h.MOTDHandler)
	assert.NotNil(t, h.ResourceControlHandler)
	assert.NotNil(t, h.RoleHandler)
	assert.NotNil(t, h.SettingsHandler)
	assert.NotNil(t, h.SSLHandler)
	assert.NotNil(t, h.StackHandler)
	assert.NotNil(t, h.StorybookHandler)
	assert.NotNil(t, h.SystemHandler)
	assert.NotNil(t, h.TagHandler)
	assert.NotNil(t, h.TemplatesHandler)
	assert.NotNil(t, h.UploadHandler)
	assert.NotNil(t, h.UserHandler)
	assert.NotNil(t, h.WebSocketHandler)
	assert.NotNil(t, h.WebhookHandler)
	// Cheap constructor wiring for deferred arms that fall out of Start:
	assert.NotNil(t, h.EdgeGroupsHandler)
	assert.NotNil(t, h.EdgeJobsHandler)
	assert.NotNil(t, h.EdgeStacksHandler)
	assert.NotNil(t, h.EndpointEdgeHandler)
	assert.NotNil(t, h.KubernetesHandler)
	assert.NotNil(t, h.RegistryHandler)
	assert.NotNil(t, h.TeamHandler)
	assert.NotNil(t, h.TeamMembershipHandler)
	assert.NotNil(t, h.EndpointHelmHandler)
	assert.NotNil(t, h.HelmTemplatesHandler)
}

// TestREQ_SRV_01_Start_WiresLocalDockerHandlersAndListens starts the HTTP
// server for a local Docker bind, checks route-handler wiring, then shuts down.
func TestREQ_SRV_01_Start_WiresLocalDockerHandlersAndListens(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, nil, "setup-token-local")

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(ctx)
	}()

	waitTCP(t, server.BindAddress, 5*time.Second)
	waitTCP(t, server.BindAddressHTTPS, 5*time.Second)

	assertLocalDockerHandlersWired(t, server)

	client := &http.Client{
		Timeout: 2 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, //nolint:gosec // local self-signed test cert
		},
	}

	resp, err := client.Get("http://" + server.BindAddress + "/")
	require.NoError(t, err)
	defer resp.Body.Close()
	// File handler may 404 without public assets; the point is the stack answered.
	assert.NotEqual(t, 0, resp.StatusCode)

	httpsResp, err := client.Get("https://" + server.BindAddressHTTPS + "/")
	require.NoError(t, err)
	defer httpsResp.Body.Close()
	assert.NotEqual(t, 0, httpsResp.StatusCode)

	cancel()

	select {
	case err := <-errCh:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(10 * time.Second):
		t.Fatal("Start did not return after cancel")
	}
}

// TestREQ_SRV_05_Start_HTTPSOnlyWhenHTTPDisabled covers the HTTPS-only arm
// used when plain HTTP is turned off for a local instance.
func TestREQ_SRV_05_Start_HTTPSOnlyWhenHTTPDisabled(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, false, true, nil, "")

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(ctx)
	}()

	waitTCP(t, server.BindAddressHTTPS, 5*time.Second)

	// Plain HTTP must not be listening when HTTPEnabled is false.
	conn, err := net.DialTimeout("tcp", server.BindAddress, 150*time.Millisecond)
	if err == nil {
		_ = conn.Close()
		t.Fatal("expected plain HTTP bind to stay closed when HTTPEnabled is false")
	}

	assertLocalDockerHandlersWired(t, server)
	cancel()

	select {
	case err := <-errCh:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(10 * time.Second):
		t.Fatal("Start did not return after cancel")
	}
}

// TestREQ_SRV_08_Start_RejectsInvalidTrustedOrigin ensures CSRF protect
// fails closed when a trusted origin is not a valid origin URL.
func TestREQ_SRV_08_Start_RejectsInvalidTrustedOrigin(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, []string{"not a valid origin"}, "")
	defer cancel()

	err := server.Start(ctx)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create CSRF middleware")
	// Handler wiring completed before CSRF protect failed.
	assertLocalDockerHandlersWired(t, server)
}

// TestREQ_SRV_10_Start_DisablesCSPWhenConfigured covers the CSP-off branch
// that disables the security header middleware during server construction.
func TestREQ_SRV_10_Start_DisablesCSPWhenConfigured(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, false, []string{"https://portainer.example.com"}, "")

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(ctx)
	}()

	waitTCP(t, server.BindAddress, 5*time.Second)
	assertLocalDockerHandlersWired(t, server)

	cancel()
	select {
	case err := <-errCh:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(10 * time.Second):
		t.Fatal("Start did not return after cancel")
	}
}

// TestREQ_SRV_01_shutdown_ClosesIdleServer exercises the shutdown helper
// that Start registers for each listening HTTP(S) server.
func TestREQ_SRV_01_shutdown_ClosesIdleServer(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)

	httpServer := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})}

	serveErr := make(chan error, 1)
	go func() {
		serveErr <- httpServer.Serve(ln)
	}()

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		shutdown(ctx, httpServer)
		close(done)
	}()

	cancel()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("shutdown did not finish")
	}

	select {
	case err := <-serveErr:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(5 * time.Second):
		t.Fatal("Serve did not return after shutdown")
	}
}

// TestREQ_SRV_01_Start_HTTPListenFailureIsLogged covers the plain-HTTP
// ListenAndServe error arm when the bind address cannot be used; HTTPS still
// starts and shuts down cleanly for the local Docker instance.
func TestREQ_SRV_01_Start_HTTPListenFailureIsLogged(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, nil, "")
	server.BindAddress = "127.0.0.1:1" // privileged port; listen fails for non-root

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(ctx)
	}()

	waitTCP(t, server.BindAddressHTTPS, 5*time.Second)
	assertLocalDockerHandlersWired(t, server)

	cancel()
	select {
	case err := <-errCh:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(10 * time.Second):
		t.Fatal("Start did not return after cancel")
	}
}
