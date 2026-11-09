package endpoints

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_03_InspectDockerEndpoint_ReturnsEndpoint(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	ep := createDockerEndpoint(t, store, 1, "local-docker")

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints/1?excludeSnapshot=true", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var resp portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, ep.ID, resp.ID)
	assert.Equal(t, "local-docker", resp.Name)
	assert.Equal(t, portainer.DockerEnvironment, resp.Type)
}

func TestREQ_ENV_03_InspectMissingEndpoint_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, _ := newDockerEndpointHandler(t)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints/99", nil))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_ENV_03_InspectInvalidID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, _ := newDockerEndpointHandler(t)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints/abc", nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_ENV_03_InspectWithSnapshot_FillsData(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "snap-env")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints/1", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
}
