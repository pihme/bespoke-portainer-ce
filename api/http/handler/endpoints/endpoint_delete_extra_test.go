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

func TestREQ_ENV_03_DeleteEndpoint_WithTLSTagsAndRelation(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	h, store := newDockerEndpointHandler(t)
	fs, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h.FileService = fs

	tag := &portainer.Tag{
		Name:           "to-clean",
		Endpoints:      map[portainer.EndpointID]bool{1: true},
		EndpointGroups: map[portainer.EndpointGroupID]bool{},
	}
	require.NoError(t, store.Tag().Create(tag))

	ep := createDockerEndpoint(t, store, 1, "tls-delete")
	ep.TLSConfig = portainer.TLSConfiguration{TLS: true, TLSSkipVerify: true}
	ep.TagIDs = []portainer.TagID{tag.ID}
	require.NoError(t, store.Endpoint().UpdateEndpoint(ep.ID, ep))
	require.NoError(t, store.EndpointRelation().Create(&portainer.EndpointRelation{
		EndpointID: 1,
		EdgeStacks: map[portainer.EdgeStackID]bool{},
	}))
	// create a snapshot row so delete Snapshot path is exercised (missing is only warned)
	_ = store.Snapshot().Create(&portainer.Snapshot{EndpointID: 1})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodDelete, "/endpoints/1", nil))
	require.Equal(t, http.StatusNoContent, w.Code, w.Body.String())

	_, err = store.Endpoint().Endpoint(1)
	assert.Error(t, err)

	updatedTag, err := store.Tag().Read(tag.ID)
	require.NoError(t, err)
	assert.False(t, updatedTag.Endpoints[1])
}

func TestREQ_ENV_03_DeleteEndpoint_MissingTag_StillDeletes(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	ep := createDockerEndpoint(t, store, 1, "orphan-tag")
	ep.TagIDs = []portainer.TagID{99}
	require.NoError(t, store.Endpoint().UpdateEndpoint(ep.ID, ep))

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodDelete, "/endpoints/1", nil))
	require.Equal(t, http.StatusNoContent, w.Code, w.Body.String())
}

func TestREQ_ENV_03_DeleteBatchDeprecated_RemovesEndpoints(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "a")
	createDockerEndpoint(t, store, 2, "b")

	body, err := json.Marshal(endpointDeleteBatchPayload{
		Endpoints: []endpointDeleteRequest{{ID: 1}, {ID: 2}},
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodDelete, "/endpoints", body))
	require.Equal(t, http.StatusNoContent, w.Code, w.Body.String())

	_, err = store.Endpoint().Endpoint(1)
	assert.Error(t, err)
	_, err = store.Endpoint().Endpoint(2)
	assert.Error(t, err)
}

func TestREQ_ENV_03_DeleteEndpoint_InvalidID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, _ := newDockerEndpointHandler(t)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodDelete, "/endpoints/abc", nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_ENV_03_DeleteEndpoint_CleansRegistryAccess(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "with-reg")
	reg := &portainer.Registry{
		Name: "local-reg",
		Type: portainer.CustomRegistry,
		RegistryAccesses: portainer.RegistryAccesses{
			1: {},
		},
	}
	require.NoError(t, store.Registry().Create(reg))

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodDelete, "/endpoints/1", nil))
	require.Equal(t, http.StatusNoContent, w.Code, w.Body.String())

	updated, err := store.Registry().Read(reg.ID)
	require.NoError(t, err)
	_, still := updated.RegistryAccesses[1]
	assert.False(t, still)
}
