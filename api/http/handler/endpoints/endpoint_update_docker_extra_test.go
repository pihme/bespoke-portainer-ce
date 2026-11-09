package endpoints

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_03_UpdateDockerEndpoint_GroupAndGpus(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "local")
	group := &portainer.EndpointGroup{Name: "other"}
	require.NoError(t, store.EndpointGroup().Create(group))

	body, err := json.Marshal(endpointUpdatePayload{
		GroupID: intPtr(int(group.ID)),
		Gpus:    []portainer.Pair{{Name: "gpu0", Value: "nvidia.com/gpu=0"}},
		Status:  intPtr(2),
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/1", body))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	updated, err := store.Endpoint().Endpoint(1)
	require.NoError(t, err)
	assert.Equal(t, group.ID, updated.GroupID)
	assert.Equal(t, portainer.EndpointStatusDown, updated.Status)
	assert.Equal(t, []portainer.Pair{{Name: "gpu0", Value: "nvidia.com/gpu=0"}}, updated.Gpus)
}

func TestREQ_ENV_03_UpdateDockerEndpoint_DisableTLS_DeletesFiles(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	fs, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h.FileService = fs

	ep := createDockerEndpoint(t, store, 1, "tls-env")
	ep.TLSConfig = portainer.TLSConfiguration{TLS: true, TLSSkipVerify: true}
	require.NoError(t, store.Endpoint().UpdateEndpoint(ep.ID, ep))

	tlsFalse := false
	body, err := json.Marshal(endpointUpdatePayload{TLS: &tlsFalse})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/1", body))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	updated, err := store.Endpoint().Endpoint(1)
	require.NoError(t, err)
	assert.False(t, updated.TLSConfig.TLS)
}

func TestREQ_ENV_03_UpdateDockerEndpoint_EnableTLS_SkipVerify(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	fs, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h.FileService = fs
	createDockerEndpoint(t, store, 1, "local")

	tlsTrue := true
	skip := true
	body, err := json.Marshal(endpointUpdatePayload{
		TLS:           &tlsTrue,
		TLSSkipVerify: &skip,
		TLSSkipClientVerify: &skip,
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/1", body))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	updated, err := store.Endpoint().Endpoint(1)
	require.NoError(t, err)
	assert.True(t, updated.TLSConfig.TLS)
	assert.True(t, updated.TLSConfig.TLSSkipVerify)
}

func TestREQ_ENV_03_ShouldReloadTLSConfiguration(t *testing.T) {
	t.Parallel()
	ep := &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "tcp://docker.example:2376",
		TLSConfig: portainer.TLSConfiguration{TLS: false},
	}
	tlsTrue := true
	tlsFalse := false
	skipFalse := false
	url := "tcp://docker.example:2376"

	assert.True(t, shouldReloadTLSConfiguration(ep, &endpointUpdatePayload{TLS: &tlsTrue}))
	assert.False(t, shouldReloadTLSConfiguration(ep, &endpointUpdatePayload{TLS: &tlsFalse}))

	ep.TLSConfig.TLS = true
	assert.True(t, shouldReloadTLSConfiguration(ep, &endpointUpdatePayload{
		URL: &url, TLS: &tlsTrue, TLSSkipVerify: &skipFalse,
	}))

	unix := "unix:///var/run/docker.sock"
	assert.False(t, shouldReloadTLSConfiguration(ep, &endpointUpdatePayload{
		URL: &unix, TLS: &tlsTrue, TLSSkipVerify: &skipFalse,
	}))
}

func TestREQ_ENV_03_UpdateDockerEndpoint_UserAccessPolicies(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "local")

	body, err := json.Marshal(endpointUpdatePayload{
		UserAccessPolicies: portainer.UserAccessPolicies{
			2: {RoleID: 1},
		},
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/1", body))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	updated, err := store.Endpoint().Endpoint(1)
	require.NoError(t, err)
	assert.Contains(t, updated.UserAccessPolicies, portainer.UserID(2))
}
