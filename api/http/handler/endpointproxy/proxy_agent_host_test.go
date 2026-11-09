package endpointproxy

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/proxy"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// denyBouncer wraps the test bouncer but rejects AuthorizedEndpointOperation.
// Used to test the 403 path without setting up a full JWT stack.
type denyBouncer struct {
	security.BouncerService
}

func (denyBouncer) AuthorizedEndpointOperation(_ *http.Request, _ *portainer.Endpoint) error {
	return errors.New("access denied to environment")
}

// setupProxyHandler builds a Handler backed by a real (empty) test datastore.
// The real datastore is required because proxyRequestsToAgentHostAPI uses ViewTx,
// which must execute its callback to populate the endpoint variable.
func setupProxyHandler(t *testing.T, bouncer security.BouncerService) (*Handler, *datastore.Store) {
	t.Helper()

	_, store := datastore.MustNewTestStore(t, false, false)

	h := NewHandler(bouncer)
	h.DataStore = store
	h.ProxyManager = proxy.NewManager(nil)

	return h, store
}

func TestProxyAgentHostAPI_InvalidEndpointID(t *testing.T) {
	t.Parallel()

	// A non-numeric environment ID in the URL (e.g. caused by a typo or path-traversal attempt)
	// must be rejected immediately with 400 Bad Request.
	h, _ := setupProxyHandler(t, testhelpers.NewTestRequestBouncer())

	rw := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/abc/agent/host/docker-storage", nil)

	h.ServeHTTP(rw, req)

	assert.Equal(t, http.StatusBadRequest, rw.Code)
}

func TestProxyAgentHostAPI_EndpointNotFound(t *testing.T) {
	t.Parallel()

	// The environment was deleted from the database while the user still has a
	// browser tab open. The server should return 404, not a 500 or panic.
	h, _ := setupProxyHandler(t, testhelpers.NewTestRequestBouncer())

	rw := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/99/agent/host/docker-storage", nil)

	h.ServeHTTP(rw, req)

	assert.Equal(t, http.StatusNotFound, rw.Code)
}

func TestProxyAgentHostAPI_PermissionDenied(t *testing.T) {
	t.Parallel()

	// A standard user without access to this environment must receive 403 Forbidden.
	bouncer := denyBouncer{BouncerService: testhelpers.NewTestRequestBouncer()}
	h, store := setupProxyHandler(t, bouncer)

	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   1,
		Name: "env-1",
		Type: portainer.AgentOnDockerEnvironment,
	}))

	rw := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/1/agent/host/docker-storage", nil)

	h.ServeHTTP(rw, req)

	assert.Equal(t, http.StatusForbidden, rw.Code)
}

func TestProxyAgentHostAPI_ProxyCreationFails(t *testing.T) {
	t.Parallel()

	// When a proxy for the environment has not been cached yet and the proxy factory is
	// uninitialised (e.g. a misconfigured server), the handler returns 500 rather than panicking.
	h, store := setupProxyHandler(t, testhelpers.NewTestRequestBouncer())

	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   4,
		Name: "env-4",
		Type: portainer.AgentOnDockerEnvironment,
		URL:  "tcp://agent:9001",
	}))

	rw := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/4/agent/host/docker-storage", nil)

	h.ServeHTTP(rw, req)

	// proxy.NewManager(nil) without NewProxyFactory → ErrProxyFactoryNotInitialized → 500
	assert.Equal(t, http.StatusInternalServerError, rw.Code)
}

// Verify denyBouncer satisfies the interface at compile time.
var _ security.BouncerService = denyBouncer{}

// REQ-TAI-004: a legacy Edge environment record is refused with 400; there is
// no reverse tunnel to reach it.
func TestREQ_TAI_004_ProxyAgentHostAPI_EdgeEnvironmentIsRejected(t *testing.T) {
	t.Parallel()

	h, store := setupProxyHandler(t, testhelpers.NewTestRequestBouncer())
	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:     3,
		Name:   "legacy-edge",
		Type:   portainer.EdgeAgentOnDockerEnvironment,
		EdgeID: "registered-edge-id",
	}))

	rw := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/3/agent/host/docker-storage", nil)
	h.ServeHTTP(rw, req)

	assert.Equal(t, http.StatusBadRequest, rw.Code)
	assert.Contains(t, rw.Body.String(), "Edge environments are no longer supported")
}
