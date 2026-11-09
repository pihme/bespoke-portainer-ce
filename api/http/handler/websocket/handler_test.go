package websocket

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newWebsocketTestHandler(t *testing.T) (*Handler, *portainer.Endpoint) {
	t.Helper()

	_, store := datastore.MustNewTestStore(t, true, false)

	endpoint := &portainer.Endpoint{
		ID:      2,
		Name:    "target-env",
		Type:    portainer.DockerEnvironment,
		URL:     "unix:///nonexistent/docker.sock",
		GroupID: 1,
	}
	require.NoError(t, store.Endpoint().Create(endpoint))

	handler := &Handler{
		DataStore:      store,
		requestBouncer: security.NewRequestBouncer(t.Context(), store),
	}

	return handler, endpoint
}

func TestNewHandler_RegistersConsoleRoutes(t *testing.T) {
	t.Parallel()

	h := NewHandler(testhelpers.NewTestRequestBouncer())
	require.NotNil(t, h)
	require.NotNil(t, h.Router)
	assert.NotNil(t, h.requestBouncer)
	assert.NotNil(t, h.connectionUpgrader)

	for _, path := range []string{
		"/websocket/exec",
		"/websocket/attach",
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		var match mux.RouteMatch
		ok := h.Match(req, &match)
		assert.Truef(t, ok, "expected route for %s", path)
	}
}

// REQ-TAI-002: the Kubernetes pod console and kubectl shell websockets are
// removed with Kubernetes.
func TestREQ_TAI_002_KubernetesWebsocketsAreGone(t *testing.T) {
	t.Parallel()

	h := NewHandler(testhelpers.NewTestRequestBouncer())

	for _, path := range []string{
		"/websocket/pod",
		"/websocket/kubernetes-shell",
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		assert.Equalf(t, http.StatusNotFound, rr.Code, "GET %s", path)
	}
}
