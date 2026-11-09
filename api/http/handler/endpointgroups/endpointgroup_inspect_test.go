package endpointgroups

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/portainer/portainer/api/datastore"
	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_13_InspectEndpointGroup(t *testing.T) {
	t.Parallel()

	t.Run("returns group without size by default", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		group := createCustomGroup(t, store, "inspect-me")

		req := httptest.NewRequest(http.MethodGet, "/endpoint_groups/"+strconv.Itoa(int(group.ID)), nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		var resp EndpointGroupResponse
		require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
		assert.Equal(t, group.ID, resp.ID)
		assert.Equal(t, "inspect-me", resp.Name)
		assert.Zero(t, resp.Total)
		assert.Zero(t, resp.TypeInfo.Docker)
	})

	t.Run("includes size for local docker endpoints", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		group := createCustomGroup(t, store, "sized")
		createLocalDockerEndpoint(t, store, 21, group.ID)
		createLocalDockerEndpoint(t, store, 22, group.ID)

		req := httptest.NewRequest(http.MethodGet, "/endpoint_groups/"+strconv.Itoa(int(group.ID))+"?size=true", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		var resp EndpointGroupResponse
		require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
		assert.Equal(t, 2, resp.Total)
		assert.Equal(t, 2, resp.TypeInfo.Docker)
		assert.Equal(t, 0, resp.TypeInfo.Kubernetes)
		assert.False(t, resp.TypeInfo.Mixed)
	})

	t.Run("returns 404 for missing group", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := httptest.NewRequest(http.MethodGet, "/endpoint_groups/9999", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("returns 400 for invalid id", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := httptest.NewRequest(http.MethodGet, "/endpoint_groups/not-a-number", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}
