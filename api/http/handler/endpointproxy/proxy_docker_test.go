package endpointproxy

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"strconv"
	"sync"
	"testing"
	"unsafe"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/proxy"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// registerStubEndpointProxy stores a handler in the Manager's unexported
// endpointProxies map so proxyRequestsToDockerAPI can take the cached-proxy
// success path without a live Docker daemon or ProxyFactory.
func registerStubEndpointProxy(t *testing.T, manager *proxy.Manager, endpointID portainer.EndpointID, h http.Handler) {
	t.Helper()

	field := reflect.ValueOf(manager).Elem().FieldByName("endpointProxies")
	require.True(t, field.IsValid(), "endpointProxies field missing")
	require.True(t, field.CanAddr(), "endpointProxies not addressable")

	proxies := (*sync.Map)(unsafe.Pointer(field.UnsafeAddr()))
	proxies.Store(strconv.Itoa(int(endpointID)), h)
}

func TestProxyDockerAPI_InvalidEndpointID(t *testing.T) {
	t.Parallel()

	// A non-numeric environment ID in the Docker proxy URL must be rejected with 400.
	h, _ := setupProxyHandler(t, testhelpers.NewTestRequestBouncer())

	rw := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/abc/docker/containers/json", nil)

	h.ServeHTTP(rw, req)

	assert.Equal(t, http.StatusBadRequest, rw.Code)
}

func TestProxyDockerAPI_EndpointNotFound(t *testing.T) {
	t.Parallel()

	// Deleted environment while a Docker UI tab is still open → 404, not 500.
	h, _ := setupProxyHandler(t, testhelpers.NewTestRequestBouncer())

	rw := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/99/docker/containers/json", nil)

	h.ServeHTTP(rw, req)

	assert.Equal(t, http.StatusNotFound, rw.Code)
}

func TestProxyDockerAPI_PermissionDenied(t *testing.T) {
	t.Parallel()

	// Standard user without access to this local Docker environment → 403.
	bouncer := denyBouncer{BouncerService: testhelpers.NewTestRequestBouncer()}
	h, store := setupProxyHandler(t, bouncer)

	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   1,
		Name: "local-docker",
		Type: portainer.DockerEnvironment,
		URL:  "unix:///var/run/docker.sock",
	}))

	rw := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/1/docker/containers/json", nil)

	h.ServeHTTP(rw, req)

	assert.Equal(t, http.StatusForbidden, rw.Code)
}

func TestProxyDockerAPI_ProxyCreationFails(t *testing.T) {
	t.Parallel()

	// No cached proxy and an uninitialised ProxyFactory → 500, not a panic.
	h, store := setupProxyHandler(t, testhelpers.NewTestRequestBouncer())

	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   4,
		Name: "local-docker",
		Type: portainer.DockerEnvironment,
		URL:  "unix:///var/run/docker.sock",
	}))

	rw := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/4/docker/version", nil)

	h.ServeHTTP(rw, req)

	assert.Equal(t, http.StatusInternalServerError, rw.Code)
}

func TestProxyDockerAPI_LocalDockerForwardsStrippedPathAndQuery(t *testing.T) {
	t.Parallel()

	// Local Docker environment: a cached proxy receives the Docker API path
	// with /{id}/docker stripped, and query parameters preserved (e.g. all=true).
	h, store := setupProxyHandler(t, testhelpers.NewTestRequestBouncer())

	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   10,
		Name: "local-docker",
		Type: portainer.DockerEnvironment,
		URL:  "unix:///var/run/docker.sock",
	}))

	var gotPath, gotRawQuery string
	registerStubEndpointProxy(t, h.ProxyManager, 10, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotRawQuery = r.URL.RawQuery
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[]`))
	}))

	rw := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/10/docker/containers/json?all=true&filters=%7B%7D", nil)

	h.ServeHTTP(rw, req)

	assert.Equal(t, http.StatusOK, rw.Code)
	assert.Equal(t, "[]", rw.Body.String())
	assert.Equal(t, "/containers/json", gotPath)
	assert.Equal(t, "all=true&filters=%7B%7D", gotRawQuery)
}

// REQ-TAI-004: a legacy Edge environment record is refused with 400, even when
// a proxy for it is cached.
func TestREQ_TAI_004_ProxyDockerAPI_EdgeEnvironmentIsRejected(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, false)

	h := NewHandler(testhelpers.NewTestRequestBouncer())
	h.DataStore = store
	h.ProxyManager = proxy.NewManager(nil)

	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:     14,
		Name:   "legacy-edge",
		Type:   portainer.EdgeAgentOnDockerEnvironment,
		EdgeID: "registered-edge-id",
	}))

	reached := false
	registerStubEndpointProxy(t, h.ProxyManager, 14, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reached = true
	}))

	rw := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/14/docker/version", nil)
	h.ServeHTTP(rw, req)

	assert.Equal(t, http.StatusBadRequest, rw.Code)
	assert.False(t, reached)
}

// REQ-TAI-007: a legacy Portainer Agent environment record is refused with 400,
// even when a proxy for it is cached.
func TestREQ_TAI_007_ProxyDockerAPI_AgentEnvironmentIsRejected(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, false)

	h := NewHandler(testhelpers.NewTestRequestBouncer())
	h.DataStore = store
	h.ProxyManager = proxy.NewManager(nil)

	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   15,
		Name: "legacy-agent",
		Type: portainer.AgentOnDockerEnvironment,
		URL:  "tcp://agent:9001",
	}))

	reached := false
	registerStubEndpointProxy(t, h.ProxyManager, 15, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reached = true
	}))

	rw := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/15/docker/version", nil)
	req.Header.Set(portainer.PortainerAgentTargetHeader, "node-1")
	h.ServeHTTP(rw, req)

	assert.Equal(t, http.StatusBadRequest, rw.Code)
	assert.Contains(t, rw.Body.String(), portainer.ErrAgentEnvironmentNotSupported.Error())
	assert.False(t, reached)
}
