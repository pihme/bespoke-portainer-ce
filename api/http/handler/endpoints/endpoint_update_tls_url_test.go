package endpoints

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/pkg/fips"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_03_UpdateDockerEndpoint_URLChange_ReloadsProxy(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "local")

	body, err := json.Marshal(endpointUpdatePayload{
		URL: strPtr("unix:///var/run/docker.sock"),
	})
	require.NoError(t, err)
	// same URL — should still succeed without forcing proxy path via TLS
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/1", body))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	body, err = json.Marshal(endpointUpdatePayload{
		URL: strPtr("unix:///run/docker.sock"),
	})
	require.NoError(t, err)
	w = httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/1", body))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	updated, err := store.Endpoint().Endpoint(1)
	require.NoError(t, err)
	assert.Equal(t, "unix:///run/docker.sock", updated.URL)
}

func TestREQ_ENV_03_UpdateDockerEndpoint_EnableTLS_WithCertPaths(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	h, store := newDockerEndpointHandler(t)
	fs, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h.FileService = fs
	createDockerEndpoint(t, store, 1, "local")

	tlsTrue := true
	skipFalse := false
	body, err := json.Marshal(endpointUpdatePayload{
		TLS:                 &tlsTrue,
		TLSSkipVerify:       &skipFalse,
		TLSSkipClientVerify: &skipFalse,
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/1", body))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	updated, err := store.Endpoint().Endpoint(1)
	require.NoError(t, err)
	assert.True(t, updated.TLSConfig.TLS)
	assert.False(t, updated.TLSConfig.TLSSkipVerify)
	assert.NotEmpty(t, updated.TLSConfig.TLSCACertPath)
	assert.NotEmpty(t, updated.TLSConfig.TLSCertPath)
	assert.NotEmpty(t, updated.TLSConfig.TLSKeyPath)
}

func TestREQ_ENV_03_UpdateDockerEndpoint_EnableTLS_SkipVerifyClearsCA(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	h, store := newDockerEndpointHandler(t)
	fs, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h.FileService = fs

	ep := createDockerEndpoint(t, store, 1, "local")
	ep.TLSConfig = portainer.TLSConfiguration{
		TLS:           true,
		TLSSkipVerify: false,
		TLSCACertPath: "/old/ca.pem",
		TLSCertPath:   "/old/cert.pem",
		TLSKeyPath:    "/old/key.pem",
	}
	require.NoError(t, store.Endpoint().UpdateEndpoint(ep.ID, ep))

	tlsTrue := true
	skipTrue := true
	body, err := json.Marshal(endpointUpdatePayload{
		TLS:                 &tlsTrue,
		TLSSkipVerify:       &skipTrue,
		TLSSkipClientVerify: &skipTrue,
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/1", body))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	updated, err := store.Endpoint().Endpoint(1)
	require.NoError(t, err)
	assert.True(t, updated.TLSConfig.TLS)
	assert.True(t, updated.TLSConfig.TLSSkipVerify)
	assert.Empty(t, updated.TLSConfig.TLSCACertPath)
	assert.Empty(t, updated.TLSConfig.TLSCertPath)
	assert.Empty(t, updated.TLSConfig.TLSKeyPath)
}

func TestREQ_ENV_03_ShouldReloadTLSConfiguration_ClientVerify(t *testing.T) {
	t.Parallel()
	ep := &portainer.Endpoint{
		Type:      portainer.DockerEnvironment,
		URL:       "tcp://docker.example:2376",
		TLSConfig: portainer.TLSConfiguration{TLS: true},
	}
	tlsTrue := true
	skipClientFalse := false
	skipVerifyTrue := true
	url := "tcp://docker.example:2376"
	assert.True(t, shouldReloadTLSConfiguration(ep, &endpointUpdatePayload{
		URL: &url, TLS: &tlsTrue, TLSSkipVerify: &skipVerifyTrue, TLSSkipClientVerify: &skipClientFalse,
	}))
}

func TestREQ_ENV_03_UpdateDockerEndpoint_TeamAccessPolicies(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "local")

	body, err := json.Marshal(endpointUpdatePayload{
		TeamAccessPolicies: portainer.TeamAccessPolicies{
			3: {RoleID: 1},
		},
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/1", body))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	updated, err := store.Endpoint().Endpoint(1)
	require.NoError(t, err)
	assert.Contains(t, updated.TeamAccessPolicies, portainer.TeamID(3))
}

func TestREQ_ENV_03_UpdateDockerEndpoint_TLSDisable_AfterEnabled(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	h, store := newDockerEndpointHandler(t)
	fs, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h.FileService = fs

	ep := createDockerEndpoint(t, store, 1, "local")
	ep.TLSConfig = portainer.TLSConfiguration{TLS: true, TLSSkipVerify: true}
	require.NoError(t, store.Endpoint().UpdateEndpoint(ep.ID, ep))

	tlsFalse := false
	body, err := json.Marshal(endpointUpdatePayload{TLS: &tlsFalse, URL: strPtr("unix:///var/run/docker.sock")})
	require.NoError(t, err)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/1", body))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	updated, err := store.Endpoint().Endpoint(1)
	require.NoError(t, err)
	assert.False(t, updated.TLSConfig.TLS)
}
