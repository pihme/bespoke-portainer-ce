package endpoints

import (
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_03_SnapshotDockerEndpoint_TriggersSnapshot(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "local")

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPost, "/endpoints/1/snapshot", nil))
	require.Equal(t, http.StatusNoContent, w.Code, w.Body.String())
}

func TestREQ_ENV_03_SnapshotMissingEndpoint_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, _ := newDockerEndpointHandler(t)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPost, "/endpoints/99/snapshot", nil))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_ENV_03_SnapshotInvalidID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, _ := newDockerEndpointHandler(t)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPost, "/endpoints/abc/snapshot", nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_ENV_03_SnapshotEdgeEndpoint_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	ep := createDockerEndpoint(t, store, 2, "edge-env")
	ep.Type = portainer.EdgeAgentOnDockerEnvironment
	require.NoError(t, store.Endpoint().UpdateEndpoint(ep.ID, ep))

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPost, "/endpoints/2/snapshot", nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}
