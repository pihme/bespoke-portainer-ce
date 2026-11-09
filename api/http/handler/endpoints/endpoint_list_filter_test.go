package endpoints

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_01_PaginateEndpoints(t *testing.T) {
	t.Parallel()
	eps := []portainer.Endpoint{{ID: 1}, {ID: 2}, {ID: 3}, {ID: 4}, {ID: 5}}

	assert.Len(t, paginateEndpoints(eps, 0, 0), 5, "limit 0 returns all")
	got := paginateEndpoints(eps, 0, 2)
	require.Len(t, got, 2)
	assert.Equal(t, portainer.EndpointID(1), got[0].ID)
	assert.Equal(t, portainer.EndpointID(2), got[1].ID)

	got = paginateEndpoints(eps, 2, 2)
	require.Len(t, got, 2)
	assert.Equal(t, portainer.EndpointID(3), got[0].ID)

	got = paginateEndpoints(eps, 10, 2)
	assert.Empty(t, got)

	got = paginateEndpoints(eps, -5, 2)
	require.Len(t, got, 2)
	assert.Equal(t, portainer.EndpointID(1), got[0].ID)
}

func TestREQ_ENV_01_List_FilterByNameStatusGroupAndPagination(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "alpha")
	createDockerEndpoint(t, store, 2, "beta")
	ep3 := createDockerEndpoint(t, store, 3, "gamma")
	ep3.Status = portainer.EndpointStatusDown
	require.NoError(t, store.Endpoint().UpdateEndpoint(ep3.ID, ep3))

	group := &portainer.EndpointGroup{Name: "special"}
	require.NoError(t, store.EndpointGroup().Create(group))
	ep2, err := store.Endpoint().Endpoint(2)
	require.NoError(t, err)
	ep2.GroupID = group.ID
	require.NoError(t, store.Endpoint().UpdateEndpoint(ep2.ID, ep2))

	// name filter
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints?name=alpha&excludeSnapshots=true", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var byName []portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &byName))
	require.Len(t, byName, 1)
	assert.Equal(t, "alpha", byName[0].Name)

	// status down
	w = httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints?status[]=2&excludeSnapshots=true", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var byStatus []portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &byStatus))
	require.Len(t, byStatus, 1)
	assert.Equal(t, "gamma", byStatus[0].Name)

	// groupIds
	w = httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints?groupIds[]="+strconv.Itoa(int(group.ID))+"&excludeSnapshots=true", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var byGroup []portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &byGroup))
	require.Len(t, byGroup, 1)
	assert.Equal(t, "beta", byGroup[0].Name)

	// pagination: start is 1-based in API (handler decrements)
	w = httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints?limit=1&start=2&excludeSnapshots=true&sort=Name&order=asc", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var page []portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &page))
	require.Len(t, page, 1)
	assert.Equal(t, "3", w.Header().Get("X-Total-Count"))
	assert.Equal(t, "3", w.Header().Get("X-Total-Available"))
}

func TestREQ_ENV_01_List_SearchExcludeIdsAndTypes(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "local-docker")
	createDockerEndpoint(t, store, 2, "remote-api")
	ep2, err := store.Endpoint().Endpoint(2)
	require.NoError(t, err)
	ep2.URL = "tcp://remote.example:2375"
	require.NoError(t, store.Endpoint().UpdateEndpoint(ep2.ID, ep2))

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints?search=remote&excludeSnapshots=true", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var found []portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &found))
	require.Len(t, found, 1)
	assert.Equal(t, "remote-api", found[0].Name)

	w = httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints?excludeIds[]=1&excludeSnapshots=true", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var excl []portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &excl))
	require.Len(t, excl, 1)
	assert.Equal(t, portainer.EndpointID(2), excl[0].ID)

	w = httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints?types[]=1&excludeSnapshots=true", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var byType []portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &byType))
	assert.GreaterOrEqual(t, len(byType), 2)
}

func TestREQ_ENV_01_List_FilterByTags(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	tag := &portainer.Tag{Name: "prod", Endpoints: map[portainer.EndpointID]bool{}, EndpointGroups: map[portainer.EndpointGroupID]bool{}}
	require.NoError(t, store.Tag().Create(tag))

	ep1 := createDockerEndpoint(t, store, 1, "tagged")
	ep1.TagIDs = []portainer.TagID{tag.ID}
	require.NoError(t, store.Endpoint().UpdateEndpoint(ep1.ID, ep1))
	createDockerEndpoint(t, store, 2, "untagged")

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints?tagIds[]="+strconv.Itoa(int(tag.ID))+"&tagsPartialMatch=true&excludeSnapshots=true", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var got []portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	require.Len(t, got, 1)
	assert.Equal(t, "tagged", got[0].Name)
}

func TestREQ_ENV_01_List_EndpointIdsAndExcludeGroupIds(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "keep")
	createDockerEndpoint(t, store, 2, "drop")
	group := &portainer.EndpointGroup{Name: "skip-me"}
	require.NoError(t, store.EndpointGroup().Create(group))
	ep2, err := store.Endpoint().Endpoint(2)
	require.NoError(t, err)
	ep2.GroupID = group.ID
	require.NoError(t, store.Endpoint().UpdateEndpoint(ep2.ID, ep2))

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints?endpointIds[]=1&excludeSnapshots=true", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var ids []portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &ids))
	require.Len(t, ids, 1)
	assert.Equal(t, "keep", ids[0].Name)

	w = httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints?excludeGroupIds[]="+strconv.Itoa(int(group.ID))+"&excludeSnapshots=true", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var excl []portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &excl))
	require.Len(t, excl, 1)
	assert.Equal(t, "keep", excl[0].Name)
}

func TestREQ_ENV_01_List_IncludeSnapshotsAndAgentVersions(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "local")
	agent := createDockerEndpoint(t, store, 2, "agent-env")
	agent.Type = portainer.AgentOnDockerEnvironment
	agent.Agent.Version = "2.19.0"
	require.NoError(t, store.Endpoint().UpdateEndpoint(agent.ID, agent))

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints?excludeSnapshots=false", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	w = httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodGet, "/endpoints?agentVersions[]=2.19.0&excludeSnapshots=true", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var got []portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &got))
	// agent match + non-agent docker endpoints are kept by the filter
	ids := map[portainer.EndpointID]bool{}
	for _, ep := range got {
		ids[ep.ID] = true
	}
	assert.True(t, ids[1])
	assert.True(t, ids[2])
}
