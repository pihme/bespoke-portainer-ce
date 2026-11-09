package endpointgroups

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_13_UpdateEndpointGroupAssociations(t *testing.T) {
	t.Parallel()

	t.Run("updates name and description of custom group", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		group := createCustomGroup(t, store, "old-name")

		desc := "new description"
		body, err := json.Marshal(endpointGroupUpdatePayload{
			Name:        "new-name",
			Description: &desc,
		})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPut, "/endpoint_groups/"+strconv.Itoa(int(group.ID)), bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		var updated portainer.EndpointGroup
		require.NoError(t, json.NewDecoder(w.Body).Decode(&updated))
		assert.Equal(t, "new-name", updated.Name)
		assert.Equal(t, "new description", updated.Description)

		saved, err := store.EndpointGroup().Read(group.ID)
		require.NoError(t, err)
		assert.Equal(t, "new-name", saved.Name)
		assert.Equal(t, "new description", saved.Description)
	})

	t.Run("reassigns local docker endpoints via AssociatedEndpoints", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		group := createCustomGroup(t, store, "assoc")

		keep := createLocalDockerEndpoint(t, store, 61, group.ID)
		remove := createLocalDockerEndpoint(t, store, 62, group.ID)
		add := createLocalDockerEndpoint(t, store, 63, unassignedGroupID)

		body, err := json.Marshal(endpointGroupUpdatePayload{
			AssociatedEndpoints: []portainer.EndpointID{keep.ID, add.ID},
		})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPut, "/endpoint_groups/"+strconv.Itoa(int(group.ID)), bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		kept, err := store.Endpoint().Endpoint(keep.ID)
		require.NoError(t, err)
		assert.Equal(t, group.ID, kept.GroupID)

		removed, err := store.Endpoint().Endpoint(remove.ID)
		require.NoError(t, err)
		assert.Equal(t, unassignedGroupID, removed.GroupID)

		added, err := store.Endpoint().Endpoint(add.ID)
		require.NoError(t, err)
		assert.Equal(t, group.ID, added.GroupID)
	})

	t.Run("empty AssociatedEndpoints moves all members to Unassigned", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		group := createCustomGroup(t, store, "clear-assoc")
		ep := createLocalDockerEndpoint(t, store, 64, group.ID)

		body, err := json.Marshal(endpointGroupUpdatePayload{
			AssociatedEndpoints: []portainer.EndpointID{},
		})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPut, "/endpoint_groups/"+strconv.Itoa(int(group.ID)), bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		moved, err := store.Endpoint().Endpoint(ep.ID)
		require.NoError(t, err)
		assert.Equal(t, unassignedGroupID, moved.GroupID)
	})

	t.Run("adds and removes tags on the group", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		oldTag := createTag(t, store, "old")
		newTag := createTag(t, store, "new")
		group := createCustomGroup(t, store, "tag-update")
		group.TagIDs = []portainer.TagID{oldTag.ID}
		require.NoError(t, store.EndpointGroup().Update(group.ID, group))
		oldTag.EndpointGroups[group.ID] = true
		require.NoError(t, store.Tag().Update(oldTag.ID, oldTag))

		body, err := json.Marshal(endpointGroupUpdatePayload{
			TagIDs: []portainer.TagID{newTag.ID},
		})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPut, "/endpoint_groups/"+strconv.Itoa(int(group.ID)), bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		saved, err := store.EndpointGroup().Read(group.ID)
		require.NoError(t, err)
		assert.Equal(t, []portainer.TagID{newTag.ID}, saved.TagIDs)

		savedOld, err := store.Tag().Read(oldTag.ID)
		require.NoError(t, err)
		assert.False(t, savedOld.EndpointGroups[group.ID])

		savedNew, err := store.Tag().Read(newTag.ID)
		require.NoError(t, err)
		assert.True(t, savedNew.EndpointGroups[group.ID])
	})

	t.Run("unchanged TagIDs skip tag rewrite", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		tag := createTag(t, store, "same")
		group := createCustomGroup(t, store, "same-tags")
		group.TagIDs = []portainer.TagID{tag.ID}
		require.NoError(t, store.EndpointGroup().Update(group.ID, group))
		tag.EndpointGroups[group.ID] = true
		require.NoError(t, store.Tag().Update(tag.ID, tag))

		body, err := json.Marshal(endpointGroupUpdatePayload{
			TagIDs: []portainer.TagID{tag.ID},
		})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPut, "/endpoint_groups/"+strconv.Itoa(int(group.ID)), bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		savedTag, err := store.Tag().Read(tag.ID)
		require.NoError(t, err)
		assert.True(t, savedTag.EndpointGroups[group.ID])
	})

	t.Run("returns 404 for missing group", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		body, err := json.Marshal(endpointGroupUpdatePayload{Name: "x"})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPut, "/endpoint_groups/9999", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("returns 400 for invalid id or payload", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := httptest.NewRequest(http.MethodPut, "/endpoint_groups/abc", bytes.NewReader([]byte(`{"Name":"x"}`)))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.Equal(t, http.StatusBadRequest, w.Code)

		req = httptest.NewRequest(http.MethodPut, "/endpoint_groups/1", bytes.NewReader([]byte(`{`)))
		w = httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestREQ_ENV_13_UpdateEndpointGroup_TagReconcileWithMembers(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	handler := setUpHandler(t, store)

	tag := createTag(t, store, "reconcile")
	group := createCustomGroup(t, store, "tag-reconcile")
	createLocalDockerEndpoint(t, store, 71, group.ID)

	body, err := json.Marshal(endpointGroupUpdatePayload{
		TagIDs: []portainer.TagID{tag.ID},
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPut, "/endpoint_groups/"+strconv.Itoa(int(group.ID)), bytes.NewReader(body))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	saved, err := store.EndpointGroup().Read(group.ID)
	require.NoError(t, err)
	assert.Equal(t, []portainer.TagID{tag.ID}, saved.TagIDs)

	savedTag, err := store.Tag().Read(tag.ID)
	require.NoError(t, err)
	assert.True(t, savedTag.EndpointGroups[group.ID])
}
