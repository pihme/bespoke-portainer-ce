package endpoints

import (
	"testing"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_01_FilterEndpointsByGroupIDs(t *testing.T) {
	t.Parallel()
	eps := []portainer.Endpoint{
		{ID: 1, GroupID: 1, Name: "a"},
		{ID: 2, GroupID: 2, Name: "b"},
		{ID: 3, GroupID: 1, Name: "c"},
	}
	got := filterEndpointsByGroupIDs(eps, []portainer.EndpointGroupID{1})
	require.Len(t, got, 2)
	assert.Equal(t, portainer.EndpointID(1), got[0].ID)
	assert.Equal(t, portainer.EndpointID(3), got[1].ID)
}

func TestREQ_ENV_01_FilterEndpointsByName(t *testing.T) {
	t.Parallel()
	eps := []portainer.Endpoint{
		{ID: 1, Name: "local"},
		{ID: 2, Name: "remote"},
	}
	assert.Len(t, filterEndpointsByName(eps, ""), 2)
	got := filterEndpointsByName(append([]portainer.Endpoint{}, eps...), "local")
	require.Len(t, got, 1)
	assert.Equal(t, "local", got[0].Name)
}

func TestREQ_ENV_01_FilterEndpointsByStatuses_Docker(t *testing.T) {
	t.Parallel()
	settings := &portainer.Settings{EdgeAgentCheckinInterval: 5}
	eps := []portainer.Endpoint{
		{ID: 1, Name: "up", Type: portainer.DockerEnvironment, Status: portainer.EndpointStatusUp},
		{ID: 2, Name: "down", Type: portainer.DockerEnvironment, Status: portainer.EndpointStatusDown},
	}
	got := filterEndpointsByStatuses(append([]portainer.Endpoint{}, eps...), []portainer.EndpointStatus{portainer.EndpointStatusUp}, settings)
	require.Len(t, got, 1)
	assert.Equal(t, "up", got[0].Name)

	got = filterEndpointsByStatuses(append([]portainer.Endpoint{}, eps...), []portainer.EndpointStatus{portainer.EndpointStatusDown}, settings)
	require.Len(t, got, 1)
	assert.Equal(t, "down", got[0].Name)
}

func TestREQ_ENV_01_FilterEndpointsByStatuses_EdgeCheckin(t *testing.T) {
	t.Parallel()
	settings := &portainer.Settings{EdgeAgentCheckinInterval: 60}
	now := time.Now().Unix()
	eps := []portainer.Endpoint{
		{
			ID:               1,
			Name:             "edge-online",
			Type:             portainer.EdgeAgentOnDockerEnvironment,
			EdgeCheckinInterval: 60,
			LastCheckInDate:  now,
		},
		{
			ID:              2,
			Name:            "edge-offline",
			Type:            portainer.EdgeAgentOnDockerEnvironment,
			LastCheckInDate: 0,
		},
	}
	got := filterEndpointsByStatuses(append([]portainer.Endpoint{}, eps...), []portainer.EndpointStatus{portainer.EndpointStatusUp}, settings)
	require.Len(t, got, 1)
	assert.Equal(t, "edge-online", got[0].Name)

	got = filterEndpointsByStatuses(append([]portainer.Endpoint{}, eps...), []portainer.EndpointStatus{portainer.EndpointStatusDown}, settings)
	require.Len(t, got, 1)
	assert.Equal(t, "edge-offline", got[0].Name)
}

func TestREQ_ENV_01_EndpointMatchSearchCriteria(t *testing.T) {
	t.Parallel()
	tags := map[portainer.TagID]string{1: "prod", 2: "staging"}
	ep := &portainer.Endpoint{
		Name:   "local-docker",
		URL:    "unix:///var/run/docker.sock",
		Status: portainer.EndpointStatusUp,
		TagIDs: []portainer.TagID{1},
	}
	assert.True(t, endpointMatchSearchCriteria(ep, tags, "local"))
	assert.True(t, endpointMatchSearchCriteria(ep, tags, "unix"))
	assert.True(t, endpointMatchSearchCriteria(ep, tags, "up"))
	assert.True(t, endpointMatchSearchCriteria(ep, tags, "prod"))
	assert.False(t, endpointMatchSearchCriteria(ep, tags, "missing"))

	ep.Status = portainer.EndpointStatusDown
	assert.True(t, endpointMatchSearchCriteria(ep, tags, "down"))
}

func TestREQ_ENV_01_EndpointGroupMatchSearchCriteria(t *testing.T) {
	t.Parallel()
	tags := map[portainer.TagID]string{5: "grouptag"}
	ep := &portainer.Endpoint{GroupID: 2}
	groups := []portainer.EndpointGroup{
		{ID: 1, Name: "other"},
		{ID: 2, Name: "default-group", TagIDs: []portainer.TagID{5}},
	}
	assert.True(t, endpointGroupMatchSearchCriteria(ep, groups, tags, "default"))
	assert.True(t, endpointGroupMatchSearchCriteria(ep, groups, tags, "grouptag"))
	assert.False(t, endpointGroupMatchSearchCriteria(ep, groups, tags, "nope"))
}

func TestREQ_ENV_01_FilteredEndpointsByTags_PartialAndFull(t *testing.T) {
	t.Parallel()
	groups := []portainer.EndpointGroup{
		{ID: 1, Name: "g1", TagIDs: []portainer.TagID{10}},
		{ID: 2, Name: "g2"},
	}
	eps := []portainer.Endpoint{
		{ID: 1, GroupID: 1, TagIDs: []portainer.TagID{1}},
		{ID: 2, GroupID: 2, TagIDs: []portainer.TagID{2, 3}},
		{ID: 3, GroupID: 2, TagIDs: []portainer.TagID{1, 2}},
	}

	partial := filteredEndpointsByTags(append([]portainer.Endpoint{}, eps...), []portainer.TagID{1}, groups, true)
	require.Len(t, partial, 2) // ep1 via endpoint tag, ep1 also group? ep1 has tag 1; ep3 has tag 1

	// full match requires all tags present on endpoint or its group
	full := filteredEndpointsByTags(append([]portainer.Endpoint{}, eps...), []portainer.TagID{2, 3}, groups, false)
	require.Len(t, full, 1)
	assert.Equal(t, portainer.EndpointID(2), full[0].ID)

	// group tag contributes to match
	viaGroup := filteredEndpointsByTags(append([]portainer.Endpoint{}, eps...), []portainer.TagID{10}, groups, true)
	require.Len(t, viaGroup, 1)
	assert.Equal(t, portainer.EndpointID(1), viaGroup[0].ID)
}

func TestREQ_ENV_01_FilterEndpointsBySearchCriteria_CombinesSources(t *testing.T) {
	t.Parallel()
	eps := []portainer.Endpoint{
		{ID: 1, Name: "alpha", GroupID: 1, URL: "tcp://a:2375"},
		{ID: 2, Name: "beta", GroupID: 2, URL: "tcp://b:2375"},
	}
	groups := []portainer.EndpointGroup{{ID: 2, Name: "special-group"}}
	got := filterEndpointsBySearchCriteria(append([]portainer.Endpoint{}, eps...), groups, nil, nil, "special")
	require.Len(t, got, 1)
	assert.Equal(t, "beta", got[0].Name)
}

func TestREQ_ENV_01_GetEndpointGroup(t *testing.T) {
	t.Parallel()
	groups := []portainer.EndpointGroup{{ID: 1, Name: "a"}, {ID: 2, Name: "b"}}
	assert.Equal(t, "b", getEndpointGroup(2, groups).Name)
	assert.Equal(t, portainer.EndpointGroup{}, getEndpointGroup(99, groups))
}
