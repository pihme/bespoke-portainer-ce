package endpointgroups

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_13_CreateEndpointGroup(t *testing.T) {
	t.Parallel()

	t.Run("creates group with name and description", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		body, err := json.Marshal(endpointGroupCreatePayload{
			Name:        "prod-docker",
			Description: "local docker environments",
		})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/endpoint_groups", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		var created portainer.EndpointGroup
		require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
		assert.Equal(t, "prod-docker", created.Name)
		assert.Equal(t, "local docker environments", created.Description)
		assert.NotZero(t, created.ID)
		assert.NotEqual(t, unassignedGroupID, created.ID)

		saved, err := store.EndpointGroup().Read(created.ID)
		require.NoError(t, err)
		assert.Equal(t, "prod-docker", saved.Name)
		assert.Empty(t, saved.TagIDs)
		assert.Empty(t, saved.UserAccessPolicies)
		assert.Empty(t, saved.TeamAccessPolicies)
	})

	t.Run("rejects empty name", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		body, err := json.Marshal(endpointGroupCreatePayload{Name: ""})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/endpoint_groups", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("rejects invalid JSON", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := httptest.NewRequest(http.MethodPost, "/endpoint_groups", bytes.NewReader([]byte(`{`)))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("associates local docker endpoints on create", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		ep1 := createLocalDockerEndpoint(t, store, 10, unassignedGroupID)
		ep2 := createLocalDockerEndpoint(t, store, 11, unassignedGroupID)
		_ = createLocalDockerEndpoint(t, store, 12, unassignedGroupID)

		body, err := json.Marshal(endpointGroupCreatePayload{
			Name:                "docker-group",
			AssociatedEndpoints: []portainer.EndpointID{ep1.ID, ep2.ID},
		})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/endpoint_groups", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		var created portainer.EndpointGroup
		require.NoError(t, json.NewDecoder(w.Body).Decode(&created))

		updated1, err := store.Endpoint().Endpoint(ep1.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, updated1.GroupID)

		updated2, err := store.Endpoint().Endpoint(ep2.ID)
		require.NoError(t, err)
		assert.Equal(t, created.ID, updated2.GroupID)

		leftAlone, err := store.Endpoint().Endpoint(12)
		require.NoError(t, err)
		assert.Equal(t, unassignedGroupID, leftAlone.GroupID)
	})

	t.Run("links tags to the new group", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		tag := createTag(t, store, "region-eu")

		body, err := json.Marshal(endpointGroupCreatePayload{
			Name:   "tagged-group",
			TagIDs: []portainer.TagID{tag.ID},
		})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/endpoint_groups", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		var created portainer.EndpointGroup
		require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
		assert.Equal(t, []portainer.TagID{tag.ID}, created.TagIDs)

		savedTag, err := store.Tag().Read(tag.ID)
		require.NoError(t, err)
		assert.True(t, savedTag.EndpointGroups[created.ID])
	})

	t.Run("nil TagIDs become empty slice", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		body, err := json.Marshal(map[string]any{"Name": "no-tags"})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/endpoint_groups", bytes.NewReader(body))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		var created portainer.EndpointGroup
		require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
		saved, err := store.EndpointGroup().Read(created.ID)
		require.NoError(t, err)
		assert.Empty(t, saved.TagIDs)
	})
}
