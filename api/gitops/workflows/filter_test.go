package workflows

import (
	"errors"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/authorization"
	"github.com/portainer/portainer/api/kubernetes/cli"
	"github.com/portainer/portainer/api/stacks/stackutils"

	kfake "k8s.io/client-go/kubernetes/fake"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestArtifactBackingExists_StackExists(t *testing.T) {
	t.Parallel()

	exists, err := ArtifactBackingExists(
		portainer.Artifact{StackID: 1},
		func(portainer.StackID) (bool, error) { return true, nil },
		func(portainer.EdgeStackID) (bool, error) { return false, nil },
	)
	require.NoError(t, err)
	require.True(t, exists)
}

func TestArtifactBackingExists_StackMissing(t *testing.T) {
	t.Parallel()

	exists, err := ArtifactBackingExists(
		portainer.Artifact{StackID: 999},
		func(portainer.StackID) (bool, error) { return false, nil },
		func(portainer.EdgeStackID) (bool, error) { return true, nil },
	)
	require.NoError(t, err)
	require.False(t, exists)
}

func TestArtifactBackingExists_EdgeStackExists(t *testing.T) {
	t.Parallel()

	exists, err := ArtifactBackingExists(
		portainer.Artifact{EdgeStackID: 1},
		func(portainer.StackID) (bool, error) { return false, nil },
		func(portainer.EdgeStackID) (bool, error) { return true, nil },
	)
	require.NoError(t, err)
	require.True(t, exists)
}

func TestArtifactBackingExists_NeitherIDSet(t *testing.T) {
	t.Parallel()

	exists, err := ArtifactBackingExists(
		portainer.Artifact{},
		func(portainer.StackID) (bool, error) { return true, nil },
		func(portainer.EdgeStackID) (bool, error) { return true, nil },
	)
	require.NoError(t, err)
	require.False(t, exists)
}

func TestArtifactBackingExists_PropagatesError(t *testing.T) {
	t.Parallel()

	wantErr := errors.New("boom")
	_, err := ArtifactBackingExists(
		portainer.Artifact{StackID: 1},
		func(portainer.StackID) (bool, error) { return false, wantErr },
		func(portainer.EdgeStackID) (bool, error) { return true, nil },
	)
	require.ErrorIs(t, err, wantErr)
}

func TestFilterDockerStacksByAccess_KubeStacksPassThrough(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	user := &portainer.User{
		ID:                      1,
		Username:                "standard",
		Role:                    portainer.StandardUserRole,
		PortainerAuthorizations: authorization.DefaultPortainerAuthorizations(),
	}
	require.NoError(t, store.User().Create(user))

	sc := &security.RestrictedRequestContext{
		IsAdmin: false,
		UserID:  1,
	}

	kubeStack := portainer.Stack{ID: 1, Name: "kube-stack", Type: portainer.KubernetesStack}
	dockerStack := portainer.Stack{ID: 2, Name: "docker-stack", Type: portainer.DockerComposeStack}

	stacks := []portainer.Stack{kubeStack, dockerStack}

	var result []portainer.Stack
	err := store.ViewTx(func(tx dataservices.DataStoreTx) error {
		var txErr error
		result, txErr = FilterDockerStacksByAccess(tx, stacks, sc)
		return txErr
	})
	require.NoError(t, err)
	require.Len(t, result, 1)
	require.Equal(t, "kube-stack", result[0].Name)
}

func TestFilterDockerStacksByAccess_AdminGetsAll(t *testing.T) {
	t.Parallel()

	sc := &security.RestrictedRequestContext{
		IsAdmin: true,
		UserID:  1,
	}

	stacks := []portainer.Stack{
		{ID: 1, Name: "kube-stack", Type: portainer.KubernetesStack},
		{ID: 2, Name: "docker-stack", Type: portainer.DockerComposeStack},
	}

	result, err := FilterDockerStacksByAccess(nil, stacks, sc)
	require.NoError(t, err)
	require.Len(t, result, 2)
}

func TestBuildEndpointAccessMap_AdminIsKubeAdmin(t *testing.T) {
	t.Parallel()

	sc := &security.RestrictedRequestContext{
		IsAdmin: true,
		UserID:  1,
	}

	endpointMap := map[portainer.EndpointID]portainer.Endpoint{
		1: {ID: 1, Type: portainer.KubernetesLocalEnvironment},
		2: {ID: 2, Type: portainer.DockerEnvironment},
	}

	result, err := buildEndpointAccessMap(nil, sc, endpointMap)
	require.NoError(t, err)
	require.Len(t, result, 1)
	require.True(t, result[1].IsKubeAdmin)
	require.Empty(t, result[1].NonAdminNamespaces)
}

func TestFilterK8SStacks_AdminIncludesAllK8SStacks(t *testing.T) {
	t.Parallel()

	stacks := []portainer.Stack{
		{ID: 1, Name: "stack-name", EndpointID: 1, Namespace: "default", Type: portainer.KubernetesStack},
	}

	accessMap := map[portainer.EndpointID]endpointAccess{
		1: {IsKubeAdmin: true},
	}

	result := filterK8SStacks(stacks, accessMap)
	require.Len(t, result, 1)
	assert.Equal(t, "stack-name", result[0].Name)
	assert.Equal(t, "default", result[0].Namespace)
}

func TestFilterK8SStacks_DockerStacksPassThrough(t *testing.T) {
	t.Parallel()

	stacks := []portainer.Stack{
		{ID: 1, Name: "docker-stack", EndpointID: 1, Type: portainer.DockerComposeStack},
	}

	// No access is resolved for the endpoint; Docker stacks must still pass through.
	result := filterK8SStacks(stacks, map[portainer.EndpointID]endpointAccess{})
	require.Len(t, result, 1)
	assert.Equal(t, "docker-stack", result[0].Name)
}

func TestFilterK8SStacks_NonAdminWithNamespaceAccess(t *testing.T) {
	t.Parallel()

	stacks := []portainer.Stack{
		{ID: 1, Name: "stack-name", EndpointID: 1, Namespace: "ns1", Type: portainer.KubernetesStack},
	}

	accessMap := map[portainer.EndpointID]endpointAccess{
		1: {IsKubeAdmin: false, NonAdminNamespaces: []string{"ns1"}},
	}

	result := filterK8SStacks(stacks, accessMap)
	require.Len(t, result, 1)
	assert.Equal(t, "stack-name", result[0].Name)
}

func TestResolveKubeAccess_NonAdminWithTeamMemberships(t *testing.T) {
	t.Parallel()

	fakeKubeClient := kfake.NewSimpleClientset()
	kcl := cli.NewTestKubeClient(fakeKubeClient)
	factory := cli.NewTestClientFactory(1, kcl)

	ep := &portainer.Endpoint{
		ID:   1,
		Type: portainer.KubernetesLocalEnvironment,
	}

	sc := &security.RestrictedRequestContext{
		IsAdmin: false,
		UserID:  1,
		UserMemberships: []portainer.TeamMembership{
			{TeamID: 5},
		},
	}

	access, err := ResolveKubeAccess(factory, sc, ep)
	require.NoError(t, err)
	require.False(t, access.IsKubeAdmin)
	require.Equal(t, []string{"default"}, access.NonAdminNamespaces)
}

func TestResolveKubeAccess_NonAdmin(t *testing.T) {
	t.Parallel()

	fakeKubeClient := kfake.NewSimpleClientset()
	kcl := cli.NewTestKubeClient(fakeKubeClient)
	factory := cli.NewTestClientFactory(1, kcl)

	ep := &portainer.Endpoint{
		ID:   1,
		Type: portainer.KubernetesLocalEnvironment,
	}

	sc := &security.RestrictedRequestContext{
		IsAdmin: false,
		UserID:  1,
	}

	access, err := ResolveKubeAccess(factory, sc, ep)
	require.NoError(t, err)
	require.False(t, access.IsKubeAdmin)
	require.Equal(t, []string{"default"}, access.NonAdminNamespaces)
}

func TestFilterK8SStacks_NonAdminWithoutNamespaceAccess(t *testing.T) {
	t.Parallel()

	stacks := []portainer.Stack{
		{ID: 1, Name: "stack-name", EndpointID: 1, Namespace: "ns1", Type: portainer.KubernetesStack},
	}

	accessMap := map[portainer.EndpointID]endpointAccess{
		1: {IsKubeAdmin: false, NonAdminNamespaces: []string{}},
	}

	result := filterK8SStacks(stacks, accessMap)
	require.Empty(t, result)
}

func TestREQ_GIT_01_HasAccessibleSource(t *testing.T) {
	t.Parallel()

	sourceMap := map[portainer.SourceID]portainer.Source{
		1: {ID: 1},
	}

	assert.False(t, HasAccessibleSource(nil, sourceMap))
	assert.False(t, HasAccessibleSource([]portainer.ArtifactFile{{SourceID: 99}}, sourceMap))
	assert.True(t, HasAccessibleSource([]portainer.ArtifactFile{{SourceID: 99}, {SourceID: 1}}, sourceMap))
}

func TestREQ_GIT_01_EndpointMatchesStackType_LocalCompose(t *testing.T) {
	t.Parallel()

	standalone := portainer.Endpoint{Snapshots: []portainer.DockerSnapshot{{Swarm: false}}}
	swarm := portainer.Endpoint{Snapshots: []portainer.DockerSnapshot{{Swarm: true}}}
	noSnapshot := portainer.Endpoint{}

	assert.True(t, EndpointMatchesStackType(standalone, portainer.DockerComposeStack))
	assert.True(t, EndpointMatchesStackType(noSnapshot, portainer.DockerComposeStack))
	assert.False(t, EndpointMatchesStackType(swarm, portainer.DockerComposeStack))

	assert.True(t, EndpointMatchesStackType(swarm, portainer.DockerSwarmStack))
	assert.False(t, EndpointMatchesStackType(standalone, portainer.DockerSwarmStack))
	assert.False(t, EndpointMatchesStackType(noSnapshot, portainer.DockerSwarmStack))

	assert.True(t, EndpointMatchesStackType(standalone, portainer.StackType(99)))
}

func TestREQ_GIT_01_BuildEndpointMap_LocalDockerEndpoints(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{
			ID:   10,
			Name: "local-docker",
			Type: portainer.DockerEnvironment,
		}))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{
			ID:   20,
			Name: "unused",
			Type: portainer.DockerEnvironment,
		}))
		require.NoError(t, tx.Snapshot().Create(&portainer.Snapshot{
			EndpointID: 10,
			Docker:     &portainer.DockerSnapshot{Swarm: false, TotalCPU: 4},
		}))
		return nil
	}))

	var m map[portainer.EndpointID]portainer.Endpoint
	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		var err error
		m, err = BuildEndpointMap(tx, []portainer.Stack{
			{ID: 1, EndpointID: 10, Type: portainer.DockerComposeStack},
			{ID: 2, EndpointID: 10, Type: portainer.DockerComposeStack},
		})
		return err
	}))

	require.Len(t, m, 1)
	require.Equal(t, "local-docker", m[10].Name)
	require.Len(t, m[10].Snapshots, 1)
	require.False(t, m[10].Snapshots[0].Swarm)
	require.Equal(t, 4, m[10].Snapshots[0].TotalCPU)
}

func TestREQ_GIT_01_FilterDockerStacksByAccess_StandardUserComposeAccess(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	user := &portainer.User{
		ID:                      2,
		Username:                "standard",
		Role:                    portainer.StandardUserRole,
		PortainerAuthorizations: authorization.DefaultPortainerAuthorizations(),
	}
	require.NoError(t, store.User().Create(user))

	allowed := portainer.Stack{ID: 1, Name: "allowed-compose", EndpointID: 5, Type: portainer.DockerComposeStack}
	denied := portainer.Stack{ID: 2, Name: "denied-compose", EndpointID: 5, Type: portainer.DockerComposeStack}
	publicStack := portainer.Stack{ID: 3, Name: "public-compose", EndpointID: 5, Type: portainer.DockerComposeStack}
	kubeStack := portainer.Stack{ID: 4, Name: "kube-stack", EndpointID: 6, Type: portainer.KubernetesStack}

	require.NoError(t, store.ResourceControl().Create(&portainer.ResourceControl{
		ResourceID: stackutils.ResourceControlID(allowed.EndpointID, allowed.Name),
		Type:       portainer.StackResourceControl,
		UserAccesses: []portainer.UserResourceAccess{
			{UserID: 2, AccessLevel: portainer.ReadWriteAccessLevel},
		},
	}))
	require.NoError(t, store.ResourceControl().Create(&portainer.ResourceControl{
		ResourceID: stackutils.ResourceControlID(publicStack.EndpointID, publicStack.Name),
		Type:       portainer.StackResourceControl,
		Public:     true,
	}))

	sc := &security.RestrictedRequestContext{
		IsAdmin: false,
		UserID:  2,
	}

	var result []portainer.Stack
	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		var err error
		result, err = FilterDockerStacksByAccess(tx, []portainer.Stack{allowed, denied, publicStack, kubeStack}, sc)
		return err
	}))

	names := make([]string, 0, len(result))
	for _, s := range result {
		names = append(names, s.Name)
	}
	assert.ElementsMatch(t, []string{"allowed-compose", "public-compose", "kube-stack"}, names)
}
