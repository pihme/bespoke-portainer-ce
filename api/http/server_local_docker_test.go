package http

import (
	"context"
	"crypto/tls"
	"net"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	portainer "github.com/portainer/portainer/api"
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

func newLocalDockerHTTPServer(t *testing.T, httpEnabled, csp bool, trustedOrigins []string) (*Server, context.Context, context.CancelFunc) {
	t.Helper()
	blockExternalRequests(t)

	dataDir := t.TempDir()
	assetsDir := t.TempDir()

	fileService, err := filesystem.NewService(dataDir, dataDir)
	require.NoError(t, err)

	store := testhelpers.NewDatastore(
		testhelpers.WithSettingsService(&portainer.Settings{}),
		testhelpers.WithSSLSettingsService(&portainer.SSLSettings{HTTPEnabled: httpEnabled}),
		testhelpers.WithUsers([]portainer.User{}),
	)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	sslService := ssl.NewService(fileService, store, cancel)
	require.NoError(t, sslService.Init("127.0.0.1", "", ""))
	require.NotNil(t, sslService.GetRawCertificate())

	bindHTTP := "127.0.0.1:" + freeTCPPort(t)
	bindHTTPS := "127.0.0.1:" + freeTCPPort(t)

	server := &Server{
		BindAddress:      bindHTTP,
		BindAddressHTTPS: bindHTTPS,
		CSP:              csp,
		HTTPEnabled:      httpEnabled,
		AssetsPath:       assetsDir,
		Status:           &portainer.Status{Version: "test"},
		FileService:      fileService,
		DataStore:        store,
		ProxyManager:     proxy.NewManager(nil),
		SSLService:       sslService,
		TrustedOrigins:   trustedOrigins,
	}

	return server, ctx, cancel
}

func assertLocalDockerHandlersWired(t *testing.T, server *Server) {
	t.Helper()
	require.NotNil(t, server.Handler)
	h := server.Handler
	assert.NotNil(t, h.CustomTemplatesHandler)
	assert.NotNil(t, h.DockerHandler)
	assert.NotNil(t, h.EndpointHandler)
	assert.NotNil(t, h.EndpointProxyHandler)
	assert.NotNil(t, h.FileHandler)
	assert.NotNil(t, h.GitOperationHandler)
	assert.NotNil(t, h.SettingsHandler)
	assert.NotNil(t, h.SSLHandler)
	assert.NotNil(t, h.StackHandler)
	assert.NotNil(t, h.StorybookHandler)
	assert.NotNil(t, h.SystemHandler)
	assert.NotNil(t, h.TemplatesHandler)
	assert.NotNil(t, h.UploadHandler)
	assert.NotNil(t, h.UserHandler)
	assert.NotNil(t, h.WebSocketHandler)
	// Cheap constructor wiring for deferred arms that fall out of Start:
}

// TestREQ_SRV_01_Start_WiresLocalDockerHandlersAndListens starts the HTTP
// server for a local Docker bind, checks route-handler wiring, then shuts down.
func TestREQ_SRV_01_Start_WiresLocalDockerHandlersAndListens(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, nil)

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
	server, ctx, cancel := newLocalDockerHTTPServer(t, false, true, nil)

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
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, []string{"not a valid origin"})
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
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, false, []string{"https://portainer.example.com"})

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
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, nil)
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

// TestREQ_TAI_001_Start_LoginAndUserManagementRoutesAreGone starts the local
// server and checks that the login, first-admin setup, user, team, role,
// ownership, LDAP and token routes are not served any more, while the local
// operator's preferences answer without credentials.
func TestREQ_TAI_001_Start_LoginAndUserManagementRoutesAreGone(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, nil)

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(ctx)
	}()

	waitTCP(t, server.BindAddress, 5*time.Second)

	client := &http.Client{Timeout: 2 * time.Second}
	base := "http://" + server.BindAddress

	gone := []struct{ method, path string }{
		{http.MethodPost, "/api/auth"},
		{http.MethodPost, "/api/auth/logout"},
		{http.MethodPost, "/api/auth/oauth/validate"},
		{http.MethodPost, "/api/ldap/check"},
		{http.MethodGet, "/api/users/admin/check"},
		{http.MethodPost, "/api/users/admin/init"},
		{http.MethodGet, "/api/users"},
		{http.MethodPost, "/api/users"},
		{http.MethodPut, "/api/users/1/passwd"},
		{http.MethodGet, "/api/users/1/tokens"},
		{http.MethodPost, "/api/users/1/tokens"},
		{http.MethodDelete, "/api/users/1/tokens/1"},
		{http.MethodGet, "/api/users/1/memberships"},
		{http.MethodGet, "/api/users/1/effective-access"},
		{http.MethodGet, "/api/teams"},
		{http.MethodPost, "/api/teams"},
		{http.MethodGet, "/api/team_memberships"},
		{http.MethodGet, "/api/roles"},
		{http.MethodPost, "/api/resource_controls"},
		{http.MethodPut, "/api/resource_controls/1"},
		{http.MethodPut, "/api/gitops/sources/1/access"},
	}

	for _, route := range gone {
		req, err := http.NewRequest(route.method, base+route.path, nil)
		require.NoError(t, err)
		req.Header.Set("Origin", base)

		resp, err := client.Do(req)
		require.NoError(t, err)
		_ = resp.Body.Close()

		assert.Equal(t, http.StatusNotFound, resp.StatusCode, "%s %s", route.method, route.path)
	}

	resp, err := client.Get(base + "/api/users/me")
	require.NoError(t, err)
	_ = resp.Body.Close()
	assert.Equal(t, http.StatusOK, resp.StatusCode, "GET /api/users/me without credentials")

	cancel()

	select {
	case err := <-errCh:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(10 * time.Second):
		t.Fatal("Start did not return after cancel")
	}
}

// TestREQ_TAI_002_Start_KubernetesRoutesAreGone starts the local server and
// checks that the Kubernetes, Helm, kubeconfig, kubectl shell, pod console,
// Kubernetes stack and personal Helm repository routes are not served.
func TestREQ_TAI_002_Start_KubernetesRoutesAreGone(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, nil)

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(ctx)
	}()

	waitTCP(t, server.BindAddress, 5*time.Second)

	client := &http.Client{Timeout: 2 * time.Second}
	base := "http://" + server.BindAddress

	gone := []struct{ method, path string }{
		{http.MethodGet, "/api/kubernetes/config"},
		{http.MethodGet, "/api/kubernetes/1/dashboard"},
		{http.MethodGet, "/api/kubernetes/1/namespaces"},
		{http.MethodPost, "/api/kubernetes/1/manifests/dry_run"},
		{http.MethodPost, "/api/kubernetes/1/nodes/n1/drain"},
		{http.MethodGet, "/api/endpoints/1/kubernetes/api/v1/namespaces"},
		{http.MethodGet, "/api/endpoints/1/agent/kubernetes/api/v1/namespaces"},
		{http.MethodGet, "/api/endpoints/1/kubernetes/helm"},
		{http.MethodPost, "/api/endpoints/1/kubernetes/helm"},
		{http.MethodGet, "/api/templates/helm"},
		{http.MethodGet, "/api/websocket/kubernetes-shell?endpointId=1"},
		{http.MethodGet, "/api/websocket/pod?endpointId=1"},
		{http.MethodGet, "/api/users/1/helm/repositories"},
		{http.MethodPost, "/api/users/1/helm/repositories"},
		{http.MethodDelete, "/api/users/1/helm/repositories/1"},
		{http.MethodDelete, "/api/stacks/name/app?endpointId=1&namespace=default"},
	}

	for _, route := range gone {
		req, err := http.NewRequest(route.method, base+route.path, nil)
		require.NoError(t, err)
		req.Header.Set("Origin", base)

		resp, err := client.Do(req)
		require.NoError(t, err)
		_ = resp.Body.Close()

		assert.Equal(t, http.StatusNotFound, resp.StatusCode, "%s %s", route.method, route.path)
	}

	cancel()

	select {
	case err := <-errCh:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(10 * time.Second):
		t.Fatal("Start did not return after cancel")
	}
}

// REQ-TAI-003: Docker Swarm is removed; the service webhook API and the
// service force-update route answer 404 on the running server.
func TestREQ_TAI_003_Start_SwarmRoutesAreGone(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, nil)

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(ctx)
	}()

	waitTCP(t, server.BindAddress, 5*time.Second)

	client := &http.Client{Timeout: 2 * time.Second}
	base := "http://" + server.BindAddress

	gone := []struct{ method, path string }{
		{http.MethodGet, "/api/webhooks"},
		{http.MethodPost, "/api/webhooks"},
		{http.MethodPut, "/api/webhooks/1"},
		{http.MethodDelete, "/api/webhooks/1"},
		{http.MethodPost, "/api/webhooks/0f4a5c3e-1111-2222-3333-444455556666"},
		{http.MethodPut, "/api/endpoints/1/forceupdateservice"},
	}

	for _, route := range gone {
		req, err := http.NewRequest(route.method, base+route.path, nil)
		require.NoError(t, err)
		req.Header.Set("Origin", base)

		resp, err := client.Do(req)
		require.NoError(t, err)
		_ = resp.Body.Close()

		assert.Equal(t, http.StatusNotFound, resp.StatusCode, "%s %s", route.method, route.path)
	}

	cancel()

	select {
	case err := <-errCh:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(10 * time.Second):
		t.Fatal("Start did not return after cancel")
	}
}

// TestREQ_TAI_004_Start_EdgeRoutesAreGone: the Edge groups, stacks, jobs,
// agent status/check-in, global key and deprecated status routes answer 404.
func TestREQ_TAI_004_Start_EdgeRoutesAreGone(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, nil)

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(ctx)
	}()

	waitTCP(t, server.BindAddress, 5*time.Second)

	client := &http.Client{Timeout: 2 * time.Second}
	base := "http://" + server.BindAddress

	gone := []struct{ method, path string }{
		{http.MethodGet, "/api/edge_groups"},
		{http.MethodPost, "/api/edge_groups"},
		{http.MethodGet, "/api/edge_stacks"},
		{http.MethodPost, "/api/edge_stacks/create/string"},
		{http.MethodGet, "/api/edge_jobs"},
		{http.MethodPost, "/api/edge_jobs/create/string"},
		{http.MethodGet, "/api/endpoints/1/edge/status"},
		{http.MethodGet, "/api/endpoints/1/edge/stacks/1"},
		{http.MethodPost, "/api/endpoints/1/edge/jobs/1/logs"},
		{http.MethodPost, "/api/endpoints/global-key"},
		{http.MethodGet, "/api/endpoints/1/status"},
	}

	for _, route := range gone {
		req, err := http.NewRequest(route.method, base+route.path, nil)
		require.NoError(t, err)
		req.Header.Set("Origin", base)

		resp, err := client.Do(req)
		require.NoError(t, err)
		_ = resp.Body.Close()

		if route.path == "/api/endpoints/global-key" {
			// Only /endpoints/{id} is left to match; it has no POST.
			assert.Equal(t, http.StatusMethodNotAllowed, resp.StatusCode, "%s %s", route.method, route.path)
			continue
		}

		assert.Equal(t, http.StatusNotFound, resp.StatusCode, "%s %s", route.method, route.path)
	}

	cancel()

	select {
	case err := <-errCh:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(10 * time.Second):
		t.Fatal("Start did not return after cancel")
	}
}

// TestREQ_TAI_005_Start_RegistryRoutesAreGone: the registry catalog, the
// per-environment registry access and the Docker Hub pull-limit routes answer 404.
func TestREQ_TAI_005_Start_RegistryRoutesAreGone(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, nil)

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(ctx)
	}()

	waitTCP(t, server.BindAddress, 5*time.Second)

	client := &http.Client{Timeout: 2 * time.Second}
	base := "http://" + server.BindAddress

	gone := []struct{ method, path string }{
		{http.MethodGet, "/api/registries"},
		{http.MethodPost, "/api/registries"},
		{http.MethodGet, "/api/registries/1"},
		{http.MethodPut, "/api/registries/1"},
		{http.MethodDelete, "/api/registries/1"},
		{http.MethodPost, "/api/registries/1/configure"},
		{http.MethodPost, "/api/registries/ping"},
		{http.MethodGet, "/api/registries/proxies/gitlab/api/v4/projects"},
		{http.MethodGet, "/api/endpoints/1/registries"},
		{http.MethodPut, "/api/endpoints/1/registries/1"},
		{http.MethodGet, "/api/endpoints/1/dockerhub/0"},
	}

	for _, route := range gone {
		req, err := http.NewRequest(route.method, base+route.path, nil)
		require.NoError(t, err)
		req.Header.Set("Origin", base)

		resp, err := client.Do(req)
		require.NoError(t, err)
		_ = resp.Body.Close()

		assert.Equal(t, http.StatusNotFound, resp.StatusCode, "%s %s", route.method, route.path)
	}

	cancel()

	select {
	case err := <-errCh:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(10 * time.Second):
		t.Fatal("Start did not return after cancel")
	}
}

// TestREQ_TAI_006_Start_BackupRoutesAreGone: the backup download and the
// restore-from-file routes answer 404.
func TestREQ_TAI_006_Start_BackupRoutesAreGone(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, nil)

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(ctx)
	}()

	waitTCP(t, server.BindAddress, 5*time.Second)

	client := &http.Client{Timeout: 2 * time.Second}
	base := "http://" + server.BindAddress

	gone := []struct{ method, path string }{
		{http.MethodPost, "/api/backup"},
		{http.MethodPost, "/api/restore"},
		{http.MethodGet, "/api/backup/s3/settings"},
	}

	for _, route := range gone {
		req, err := http.NewRequest(route.method, base+route.path, nil)
		require.NoError(t, err)
		req.Header.Set("Origin", base)

		resp, err := client.Do(req)
		require.NoError(t, err)
		_ = resp.Body.Close()

		assert.Equal(t, http.StatusNotFound, resp.StatusCode, "%s %s", route.method, route.path)
	}

	cancel()

	select {
	case err := <-errCh:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(10 * time.Second):
		t.Fatal("Start did not return after cancel")
	}
}

// REQ-TAI-007: the Portainer Agent routes are removed. The agent versions list
// is gone (the path now falls through to /endpoints/{id} and is refused as an
// invalid identifier), and the Agent proxy routes answer 404.
func TestREQ_TAI_007_Start_AgentRoutesAreGone(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, nil)

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(ctx)
	}()

	waitTCP(t, server.BindAddress, 5*time.Second)

	client := &http.Client{Timeout: 2 * time.Second}
	base := "http://" + server.BindAddress

	gone := []struct {
		method, path string
		status       int
	}{
		{http.MethodGet, "/api/endpoints/agent_versions", http.StatusBadRequest},
		{http.MethodGet, "/api/endpoints/1/agent/docker/containers/json", http.StatusNotFound},
		{http.MethodGet, "/api/endpoints/1/agent/host/docker-storage", http.StatusNotFound},
	}

	for _, route := range gone {
		req, err := http.NewRequest(route.method, base+route.path, nil)
		require.NoError(t, err)
		req.Header.Set("Origin", base)

		resp, err := client.Do(req)
		require.NoError(t, err)
		_ = resp.Body.Close()

		assert.Equal(t, route.status, resp.StatusCode, "%s %s", route.method, route.path)
	}

	cancel()

	select {
	case err := <-errCh:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(10 * time.Second):
		t.Fatal("Start did not return after cancel")
	}
}

// REQ-TAI-008: the Azure API proxy route is removed with Azure Container
// Instances and answers 404.
func TestREQ_TAI_008_Start_AzureRoutesAreGone(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, nil)

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(ctx)
	}()

	waitTCP(t, server.BindAddress, 5*time.Second)

	client := &http.Client{Timeout: 2 * time.Second}
	base := "http://" + server.BindAddress

	for _, path := range []string{
		"/api/endpoints/1/azure/subscriptions",
		"/api/endpoints/1/azure/subscriptions/s1/providers/Microsoft.ContainerInstance/containerGroups",
	} {
		req, err := http.NewRequest(http.MethodGet, base+path, nil)
		require.NoError(t, err)
		req.Header.Set("Origin", base)

		resp, err := client.Do(req)
		require.NoError(t, err)
		_ = resp.Body.Close()

		assert.Equal(t, http.StatusNotFound, resp.StatusCode, path)
	}

	cancel()

	select {
	case err := <-errCh:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(10 * time.Second):
		t.Fatal("Start did not return after cancel")
	}
}

// REQ-TAI-011: the GitOps workflows view is removed; its API routes answer
// 404 while Git sources stay reachable.
func TestREQ_TAI_011_Start_WorkflowsRoutesAreGone(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, nil)

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(ctx)
	}()

	waitTCP(t, server.BindAddress, 5*time.Second)

	client := &http.Client{Timeout: 2 * time.Second}
	base := "http://" + server.BindAddress

	get := func(path string) int {
		req, err := http.NewRequest(http.MethodGet, base+path, nil)
		require.NoError(t, err)
		req.Header.Set("Origin", base)

		resp, err := client.Do(req)
		require.NoError(t, err)
		_ = resp.Body.Close()

		return resp.StatusCode
	}

	for _, path := range []string{
		"/api/gitops/workflows",
		"/api/gitops/workflows/1",
		"/api/gitops/workflows/summary",
	} {
		assert.Equal(t, http.StatusNotFound, get(path), path)
	}

	assert.Equal(t, http.StatusOK, get("/api/gitops/sources"))

	cancel()

	select {
	case err := <-errCh:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(10 * time.Second):
		t.Fatal("Start did not return after cancel")
	}
}

func TestREQ_TAI_013_Start_GroupAndTagRoutesAreGone(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, nil)

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(ctx)
	}()

	waitTCP(t, server.BindAddress, 5*time.Second)

	client := &http.Client{Timeout: 2 * time.Second}
	base := "http://" + server.BindAddress

	get := func(path string) int {
		req, err := http.NewRequest(http.MethodGet, base+path, nil)
		require.NoError(t, err)
		req.Header.Set("Origin", base)

		resp, err := client.Do(req)
		require.NoError(t, err)
		_ = resp.Body.Close()

		return resp.StatusCode
	}

	do := func(method, path string) int {
		req, err := http.NewRequest(method, base+path, strings.NewReader(`{}`))
		require.NoError(t, err)
		req.Header.Set("Origin", base)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		require.NoError(t, err)
		_ = resp.Body.Close()

		return resp.StatusCode
	}

	for _, path := range []string{
		"/api/endpoint_groups",
		"/api/endpoint_groups/1",
		"/api/tags",
	} {
		assert.Equal(t, http.StatusNotFound, get(path), path)
	}

	for _, tc := range []struct{ method, path string }{
		{http.MethodPost, "/api/endpoint_groups"},
		{http.MethodPut, "/api/endpoint_groups/1"},
		{http.MethodDelete, "/api/endpoint_groups/2"},
		{http.MethodPut, "/api/endpoint_groups/1/endpoints/1"},
		{http.MethodDelete, "/api/endpoint_groups/1/endpoints/1"},
		{http.MethodPost, "/api/tags"},
		{http.MethodDelete, "/api/tags/1"},
	} {
		assert.Equal(t, http.StatusNotFound, do(tc.method, tc.path), tc.method+" "+tc.path)
	}

	// The bulk group/tag relations route is gone; /endpoints/{id} does not
	// accept PUT on "relations" as an ID.
	assert.NotEqual(t, http.StatusNoContent, do(http.MethodPut, "/api/endpoints/relations"))

	assert.Equal(t, http.StatusOK, get("/api/endpoints"))

	cancel()

	select {
	case err := <-errCh:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(10 * time.Second):
		t.Fatal("Start did not return after cancel")
	}
}

func TestREQ_TAI_012_Start_UpsellRoutesAreGone(t *testing.T) {
	server, ctx, cancel := newLocalDockerHTTPServer(t, true, true, nil)

	errCh := make(chan error, 1)
	go func() {
		errCh <- server.Start(ctx)
	}()

	waitTCP(t, server.BindAddress, 5*time.Second)

	client := &http.Client{Timeout: 2 * time.Second}
	base := "http://" + server.BindAddress

	get := func(path string) int {
		req, err := http.NewRequest(http.MethodGet, base+path, nil)
		require.NoError(t, err)
		req.Header.Set("Origin", base)

		resp, err := client.Do(req)
		require.NoError(t, err)
		_ = resp.Body.Close()

		return resp.StatusCode
	}

	post := func(path string) int {
		req, err := http.NewRequest(http.MethodPost, base+path, strings.NewReader(`{"License":"1-abc"}`))
		require.NoError(t, err)
		req.Header.Set("Origin", base)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		require.NoError(t, err)
		_ = resp.Body.Close()

		return resp.StatusCode
	}

	assert.Equal(t, http.StatusNotFound, get("/api/motd"), "/api/motd")
	assert.Equal(t, http.StatusNotFound, post("/api/system/upgrade"), "/api/system/upgrade")

	// The rest of the system API stays.
	assert.Equal(t, http.StatusOK, get("/api/system/status"))

	cancel()

	select {
	case err := <-errCh:
		require.ErrorIs(t, err, http.ErrServerClosed)
	case <-time.After(10 * time.Second):
		t.Fatal("Start did not return after cancel")
	}
}
