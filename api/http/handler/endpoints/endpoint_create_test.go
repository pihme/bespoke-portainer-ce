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
		name           string
		endpointType   portainer.EndpointType
		expectRelation bool
	}{
		{
			name:           "create azure environment, expect no relation to be created",
			endpointType:   portainer.AzureEnvironment,
			expectRelation: false,
		},
		{
			name:           "create kubernetes environment, expect no relation to be created",
			endpointType:   portainer.KubernetesLocalEnvironment,
			expectRelation: false,
		},
		{
			name:           "create kubeconfig environment, expect no relation to be created",
			endpointType:   portainer.AgentOnKubernetesEnvironment,
			expectRelation: false,
		},
		{
			name:           "create agent docker environment, expect no relation to be created",
			endpointType:   portainer.AgentOnDockerEnvironment,
			expectRelation: false,
		},
		{
			name:           "create unsecured environment, expect no relation to be created",
			endpointType:   portainer.DockerEnvironment,
			expectRelation: false,
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

			relation, relationErr := store.EndpointRelation().EndpointRelation(endpoint.ID)
			if testCase.expectRelation {
				require.NoError(t, relationErr)
				require.NotNil(t, relation)
			} else {
				require.Error(t, relationErr)
				require.True(t, store.IsErrObjectNotFound(relationErr))
				require.Nil(t, relation)
			}
		})
	}
}
