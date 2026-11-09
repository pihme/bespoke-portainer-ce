package endpointgroups

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/portainer/portainer/api/datastore"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_13_AddEndpointToGroup(t *testing.T) {
	t.Parallel()

	t.Run("adds local docker endpoint to group", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		group := createCustomGroup(t, store, "add-target")
		ep := createLocalDockerEndpoint(t, store, 41, unassignedGroupID)

		path := "/endpoint_groups/" + strconv.Itoa(int(group.ID)) + "/endpoints/" + strconv.Itoa(int(ep.ID))
		req := httptest.NewRequest(http.MethodPut, path, nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusNoContent, w.Code)

		updated, err := store.Endpoint().Endpoint(ep.ID)
		require.NoError(t, err)
		assert.Equal(t, group.ID, updated.GroupID)
	})

	t.Run("returns 404 when group is missing", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		ep := createLocalDockerEndpoint(t, store, 42, unassignedGroupID)

		path := "/endpoint_groups/9999/endpoints/" + strconv.Itoa(int(ep.ID))
		req := httptest.NewRequest(http.MethodPut, path, nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("returns 404 when endpoint is missing", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		group := createCustomGroup(t, store, "add-missing-ep")

		path := "/endpoint_groups/" + strconv.Itoa(int(group.ID)) + "/endpoints/9999"
		req := httptest.NewRequest(http.MethodPut, path, nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("returns 400 for invalid route ids", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := httptest.NewRequest(http.MethodPut, "/endpoint_groups/abc/endpoints/1", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.Equal(t, http.StatusBadRequest, w.Code)

		req = httptest.NewRequest(http.MethodPut, "/endpoint_groups/1/endpoints/xyz", nil)
		w = httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}
