package endpoints

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func strPtr(s string) *string { return &s }
func intPtr(i int) *int       { return &i }

func TestREQ_ENV_03_UpdateDockerEndpoint_Renames(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "old-name")

	body, err := json.Marshal(endpointUpdatePayload{Name: strPtr("new-name")})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/1", body))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	updated, err := store.Endpoint().Endpoint(1)
	require.NoError(t, err)
	assert.Equal(t, "new-name", updated.Name)
}

func TestREQ_ENV_03_UpdateDockerEndpoint_NameCollision_ReturnsConflict(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "alpha")
	createDockerEndpoint(t, store, 2, "beta")

	body, _ := json.Marshal(endpointUpdatePayload{Name: strPtr("beta")})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/1", body))
	assert.Equal(t, http.StatusConflict, w.Code, w.Body.String())
}

func TestREQ_ENV_03_UpdateDockerEndpoint_PublicURLAndStatus(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "local")

	body, err := json.Marshal(endpointUpdatePayload{
		PublicURL: strPtr("docker.example.com:2375"),
		Status:    intPtr(1),
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/1", body))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	updated, err := store.Endpoint().Endpoint(1)
	require.NoError(t, err)
	assert.Equal(t, "docker.example.com:2375", updated.PublicURL)
}

func TestREQ_ENV_03_UpdateMissingEndpoint_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, _ := newDockerEndpointHandler(t)
	body, _ := json.Marshal(endpointUpdatePayload{Name: strPtr("x")})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/99", body))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_ENV_03_UpdateInvalidID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, _ := newDockerEndpointHandler(t)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/abc", []byte(`{}`)))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_ENV_03_UpdatePayload_Validate_OK(t *testing.T) {
	t.Parallel()
	require.NoError(t, (&endpointUpdatePayload{}).Validate(nil))
}
