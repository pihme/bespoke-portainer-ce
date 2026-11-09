package endpointutils

import (
	"errors"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/set"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type tagsEndpointService struct {
	dataservices.EndpointService
	endpoints []portainer.Endpoint
	listErr   error
}

func (s *tagsEndpointService) Endpoints() ([]portainer.Endpoint, error) {
	if s.listErr != nil {
		return nil, s.listErr
	}
	return s.endpoints, nil
}

type tagsTagService struct {
	dataservices.TagService
	tags   map[portainer.TagID]*portainer.Tag
	readErr error
}

func (s *tagsTagService) Read(id portainer.TagID) (*portainer.Tag, error) {
	if s.readErr != nil {
		return nil, s.readErr
	}
	tag, ok := s.tags[id]
	if !ok {
		return nil, errors.New("tag not found")
	}
	return tag, nil
}

type tagsDataStore struct {
	dataservices.DataStoreTx
	endpoint dataservices.EndpointService
	tag      dataservices.TagService
}

func (s *tagsDataStore) Endpoint() dataservices.EndpointService { return s.endpoint }
func (s *tagsDataStore) Tag() dataservices.TagService           { return s.tag }

func TestGetEndpointsByTags_EmptyTagIDs(t *testing.T) {
	t.Parallel()

	ids, err := GetEndpointsByTags(&tagsDataStore{}, nil, false)
	require.NoError(t, err)
	assert.Empty(t, ids)

	ids, err = GetEndpointsByTags(&tagsDataStore{}, []portainer.TagID{}, true)
	require.NoError(t, err)
	assert.Empty(t, ids)
}

func TestGetEndpointsByTags_ListEndpointsError(t *testing.T) {
	t.Parallel()

	store := &tagsDataStore{
		endpoint: &tagsEndpointService{listErr: errors.New("endpoints unavailable")},
	}

	ids, err := GetEndpointsByTags(store, []portainer.TagID{1}, false)
	require.Nil(t, ids)
	assert.EqualError(t, err, "endpoints unavailable")
}

func TestGetEndpointsByTags_TagReadError(t *testing.T) {
	t.Parallel()

	store := &tagsDataStore{
		endpoint: &tagsEndpointService{endpoints: []portainer.Endpoint{{ID: 1}}},
		tag:      &tagsTagService{readErr: errors.New("tag missing")},
	}

	ids, err := GetEndpointsByTags(store, []portainer.TagID{9}, false)
	require.Nil(t, ids)
	assert.EqualError(t, err, "tag missing")
}

func TestGetEndpointsByTags_IntersectionTrustedEdgeOnly(t *testing.T) {
	t.Parallel()

	endpoints := []portainer.Endpoint{
		{ID: 1, Type: portainer.EdgeAgentOnDockerEnvironment, UserTrusted: true, GroupID: 10},
		{ID: 2, Type: portainer.EdgeAgentOnDockerEnvironment, UserTrusted: true, GroupID: 10},
		{ID: 3, Type: portainer.EdgeAgentOnDockerEnvironment, UserTrusted: false, GroupID: 10},
		{ID: 4, Type: portainer.DockerEnvironment, UserTrusted: true, GroupID: 10},
		{ID: 5, Type: portainer.EdgeAgentOnDockerEnvironment, UserTrusted: true, GroupID: 20},
	}

	store := &tagsDataStore{
		endpoint: &tagsEndpointService{endpoints: endpoints},
		tag: &tagsTagService{tags: map[portainer.TagID]*portainer.Tag{
			1: {
				ID:             1,
				Name:           "prod",
				Endpoints:      map[portainer.EndpointID]bool{1: true, 3: true, 4: true},
				EndpointGroups: map[portainer.EndpointGroupID]bool{20: true},
			},
			2: {
				ID:             2,
				Name:           "edge",
				Endpoints:      map[portainer.EndpointID]bool{1: true, 2: true, 5: true},
				EndpointGroups: map[portainer.EndpointGroupID]bool{},
			},
		}},
	}

	ids, err := GetEndpointsByTags(store, []portainer.TagID{1, 2}, false)
	require.NoError(t, err)
	// Intersection of tag1 ({1,3,4,5 via group20}) and tag2 ({1,2,5}) = {1,5};
	// only trusted edge kept → 1 and 5.
	assert.ElementsMatch(t, []portainer.EndpointID{1, 5}, ids)
}

func TestGetEndpointsByTags_PartialMatchUnion(t *testing.T) {
	t.Parallel()

	endpoints := []portainer.Endpoint{
		{ID: 1, Type: portainer.EdgeAgentOnDockerEnvironment, UserTrusted: true, GroupID: 1},
		{ID: 2, Type: portainer.EdgeAgentOnDockerEnvironment, UserTrusted: true, GroupID: 1},
		{ID: 3, Type: portainer.EdgeAgentOnKubernetesEnvironment, UserTrusted: true, GroupID: 2},
	}

	store := &tagsDataStore{
		endpoint: &tagsEndpointService{endpoints: endpoints},
		tag: &tagsTagService{tags: map[portainer.TagID]*portainer.Tag{
			1: {ID: 1, Endpoints: map[portainer.EndpointID]bool{1: true}, EndpointGroups: map[portainer.EndpointGroupID]bool{}},
			2: {ID: 2, Endpoints: map[portainer.EndpointID]bool{3: true}, EndpointGroups: map[portainer.EndpointGroupID]bool{}},
		}},
	}

	ids, err := GetEndpointsByTags(store, []portainer.TagID{1, 2}, true)
	require.NoError(t, err)
	assert.ElementsMatch(t, []portainer.EndpointID{1, 3}, ids)
}

func TestMapEndpointGroupToEndpoints(t *testing.T) {
	t.Parallel()

	got := mapEndpointGroupToEndpoints([]portainer.Endpoint{
		{ID: 1, GroupID: 10},
		{ID: 2, GroupID: 10},
		{ID: 3, GroupID: 20},
	})

	require.Len(t, got, 2)
	assert.True(t, got[10].Contains(1))
	assert.True(t, got[10].Contains(2))
	assert.True(t, got[20].Contains(3))
	assert.False(t, got[20].Contains(1))
}

func TestMapTagsToEndpoints_MergesGroupMembers(t *testing.T) {
	t.Parallel()

	groupEndpoints := map[portainer.EndpointGroupID]set.Set[portainer.EndpointID]{
		10: {1: true, 2: true},
	}
	tags := []portainer.Tag{
		{
			ID:             1,
			Endpoints:      map[portainer.EndpointID]bool{9: true},
			EndpointGroups: map[portainer.EndpointGroupID]bool{10: true},
		},
	}

	sets := mapTagsToEndpoints(tags, groupEndpoints)
	require.Len(t, sets, 1)
	assert.True(t, sets[0].Contains(9))
	assert.True(t, sets[0].Contains(1))
	assert.True(t, sets[0].Contains(2))
}
