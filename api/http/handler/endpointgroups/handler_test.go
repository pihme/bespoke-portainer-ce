package endpointgroups

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/require"
)

func setUpHandler(t *testing.T, store *datastore.Store) *Handler {
	t.Helper()
	handler := NewHandler(testhelpers.NewTestRequestBouncer())
	handler.DataStore = store
	return handler
}

func createLocalDockerEndpoint(t *testing.T, store *datastore.Store, id portainer.EndpointID, groupID portainer.EndpointGroupID) *portainer.Endpoint {
	t.Helper()
	endpoint := &portainer.Endpoint{
		ID:      id,
		Name:    "local-docker",
		Type:    portainer.DockerEnvironment,
		URL:     "unix:///var/run/docker.sock",
		GroupID: groupID,
	}
	require.NoError(t, store.Endpoint().Create(endpoint))
	return endpoint
}

func createTag(t *testing.T, store *datastore.Store, name string) *portainer.Tag {
	t.Helper()
	tag := &portainer.Tag{
		Name:           name,
		Endpoints:      map[portainer.EndpointID]bool{},
		EndpointGroups: map[portainer.EndpointGroupID]bool{},
	}
	require.NoError(t, store.Tag().Create(tag))
	return tag
}

func createCustomGroup(t *testing.T, store *datastore.Store, name string) *portainer.EndpointGroup {
	t.Helper()
	group := &portainer.EndpointGroup{
		Name:               name,
		Description:        "custom group",
		UserAccessPolicies: portainer.UserAccessPolicies{},
		TeamAccessPolicies: portainer.TeamAccessPolicies{},
		TagIDs:             []portainer.TagID{},
	}
	require.NoError(t, store.EndpointGroup().Create(group))
	return group
}
