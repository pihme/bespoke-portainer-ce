package endpoints

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_REG_05_DockerhubStatus_PullLimitDisabled_ReturnsDefaults(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	h.PullLimitCheckDisabled = true
	createDockerEndpoint(t, store, 1, "local")

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints/1/dockerhub/0", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var resp dockerhubStatusResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, 10, resp.Limit)
	assert.Equal(t, 10, resp.Remaining)
}

func TestREQ_REG_05_DockerhubStatus_WithDockerHubRegistry_DisabledCheck(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	h.PullLimitCheckDisabled = true
	createDockerEndpoint(t, store, 1, "local")
	reg := &portainer.Registry{
		Name: "dockerhub",
		Type: portainer.DockerHubRegistry,
	}
	require.NoError(t, store.Registry().Create(reg))

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints/1/dockerhub/"+strconv.Itoa(int(reg.ID)), nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
}

func TestREQ_REG_05_DockerhubStatus_NonLocalEndpoint_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	ep := createDockerEndpoint(t, store, 1, "remote-api")
	ep.URL = "tcp://remote.example:2375"
	require.NoError(t, store.Endpoint().UpdateEndpoint(ep.ID, ep))

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints/1/dockerhub/0", nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_REG_05_DockerhubStatus_MissingEndpoint_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, _ := newDockerEndpointHandler(t)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints/99/dockerhub/0", nil))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_REG_05_DockerhubStatus_InvalidEndpointID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, _ := newDockerEndpointHandler(t)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints/abc/dockerhub/0", nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_REG_05_DockerhubStatus_InvalidRegistryID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "local")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints/1/dockerhub/abc", nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_REG_05_DockerhubStatus_MissingRegistry_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "local")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints/1/dockerhub/42", nil))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_REG_05_DockerhubStatus_NonDockerHubRegistry_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "local")
	reg := &portainer.Registry{
		Name: "ghcr",
		Type: portainer.GithubRegistry,
	}
	require.NoError(t, store.Registry().Create(reg))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints/1/dockerhub/"+strconv.Itoa(int(reg.ID)), nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_REG_05_ParseRateLimitHeader(t *testing.T) {
	t.Parallel()
	h := http.Header{}
	h.Set("RateLimit-Limit", "100;w=21600")
	v, err := parseRateLimitHeader(h, "RateLimit-Limit")
	require.NoError(t, err)
	assert.Equal(t, 100, v)

	_, err = parseRateLimitHeader(h, "RateLimit-Remaining")
	assert.Error(t, err)

	h.Set("RateLimit-Remaining", "not-a-number")
	_, err = parseRateLimitHeader(h, "RateLimit-Remaining")
	assert.Error(t, err)
}
