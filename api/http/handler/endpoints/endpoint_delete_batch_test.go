package endpoints

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_03_DeleteBatch_RemovesDockerEndpoints(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "ep-a")
	createDockerEndpoint(t, store, 2, "ep-b")
	createDockerEndpoint(t, store, 3, "ep-keep")

	body, err := json.Marshal(endpointDeleteBatchPayload{
		Endpoints: []endpointDeleteRequest{{ID: 1}, {ID: 2}},
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPost, "/endpoints/delete", body))
	require.Equal(t, http.StatusNoContent, w.Code, w.Body.String())

	_, err = store.Endpoint().Endpoint(1)
	assert.Error(t, err)
	_, err = store.Endpoint().Endpoint(2)
	assert.Error(t, err)
	kept, err := store.Endpoint().Endpoint(3)
	require.NoError(t, err)
	assert.Equal(t, "ep-keep", kept.Name)
}

func TestREQ_ENV_03_DeleteBatch_UnknownID_PartialContent(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "ep-ok")
	body, err := json.Marshal(endpointDeleteBatchPayload{
		Endpoints: []endpointDeleteRequest{{ID: 1}, {ID: 99}},
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPost, "/endpoints/delete", body))
	assert.Equal(t, http.StatusPartialContent, w.Code, w.Body.String())
	_, err = store.Endpoint().Endpoint(1)
	assert.Error(t, err)
}

func TestREQ_ENV_03_DeleteBatch_EmptyList_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, _ := newDockerEndpointHandler(t)
	body, _ := json.Marshal(endpointDeleteBatchPayload{Endpoints: []endpointDeleteRequest{}})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPost, "/endpoints/delete", body))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_ENV_03_DeleteSingle_RemovesEndpoint(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "to-delete")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodDelete, "/endpoints/1", nil))
	require.Equal(t, http.StatusNoContent, w.Code, w.Body.String())
	_, err := store.Endpoint().Endpoint(1)
	assert.Error(t, err)
}

func TestREQ_ENV_03_DeleteSingle_Missing_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, _ := newDockerEndpointHandler(t)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodDelete, "/endpoints/99", nil))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_ENV_03_DeleteBatchPayload_Validate_RequiresEndpoints(t *testing.T) {
	t.Parallel()
	p := &endpointDeleteBatchPayload{}
	assert.Error(t, p.Validate(nil))
	p.Endpoints = []endpointDeleteRequest{{ID: 1}}
	assert.NoError(t, p.Validate(nil))
}
