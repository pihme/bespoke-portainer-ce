package endpointgroups

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_13_DeleteEndpointGroup(t *testing.T) {
	t.Parallel()

	t.Run("deletes custom group and moves docker endpoints to Unassigned", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		group := createCustomGroup(t, store, "to-delete")
		ep := createLocalDockerEndpoint(t, store, 31, group.ID)

		req := httptest.NewRequest(http.MethodDelete, "/endpoint_groups/"+strconv.Itoa(int(group.ID)), nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusNoContent, w.Code)

		_, err := store.EndpointGroup().Read(group.ID)
		assert.True(t, store.IsErrObjectNotFound(err))

		moved, err := store.Endpoint().Endpoint(ep.ID)
		require.NoError(t, err)
		assert.Equal(t, unassignedGroupID, moved.GroupID)
	})

	t.Run("forbids deleting the default Unassigned group", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := httptest.NewRequest(http.MethodDelete, "/endpoint_groups/1", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)

		group, err := store.EndpointGroup().Read(unassignedGroupID)
		require.NoError(t, err)
		assert.Equal(t, unassignedGroupName, group.Name)
	})

	t.Run("returns 404 for missing group", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := httptest.NewRequest(http.MethodDelete, "/endpoint_groups/9999", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("returns 400 for invalid id", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := httptest.NewRequest(http.MethodDelete, "/endpoint_groups/abc", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("clears group from linked tags", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		tag := createTag(t, store, "cleanup-tag")
		group := createCustomGroup(t, store, "tagged-delete")
		group.TagIDs = []portainer.TagID{tag.ID}
		require.NoError(t, store.EndpointGroup().Update(group.ID, group))

		tag.EndpointGroups[group.ID] = true
		require.NoError(t, store.Tag().Update(tag.ID, tag))

		req := httptest.NewRequest(http.MethodDelete, "/endpoint_groups/"+strconv.Itoa(int(group.ID)), nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusNoContent, w.Code)

		savedTag, err := store.Tag().Read(tag.ID)
		require.NoError(t, err)
		assert.False(t, savedTag.EndpointGroups[group.ID])
	})
}
