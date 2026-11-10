package endpoints

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

// EE-only kubeconfig validation tests removed for CE

func TestSaveEndpointAndUpdateAuthorizations(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	endpointGroup := &portainer.EndpointGroup{
		ID:   1,
		Name: "test-endpoint-group",
	}

	err := store.EndpointGroup().Create(endpointGroup)
	require.NoError(t, err)

	h := &Handler{
		DataStore: store,
	}

	testCases := []struct {
		name         string
		endpointType portainer.EndpointType
	}{
		{
			name:         "create azure environment",
			endpointType: portainer.AzureEnvironment,
		},
		{
			name:         "create kubernetes environment",
			endpointType: portainer.KubernetesLocalEnvironment,
		},
		{
			name:         "create kubeconfig environment",
			endpointType: portainer.AgentOnKubernetesEnvironment,
		},
		{
			name:         "create agent docker environment",
			endpointType: portainer.AgentOnDockerEnvironment,
		},
		{
			name:         "create unsecured environment",
			endpointType: portainer.DockerEnvironment,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			endpoint := &portainer.Endpoint{
				ID:      portainer.EndpointID(store.Endpoint().GetNextIdentifier()),
				Type:    testCase.endpointType,
				GroupID: endpointGroup.ID,
			}

			err := h.saveEndpointAndUpdateAuthorizations(store, endpoint)
			require.NoError(t, err)

			stored, err := store.Endpoint().Endpoint(endpoint.ID)
			require.NoError(t, err)
			require.Equal(t, testCase.endpointType, stored.Type)
		})
	}
}
