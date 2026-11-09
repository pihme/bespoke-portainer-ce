package deployments

import (
	"context"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/api/types/system"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_StackAuthorMissingErr_Error(t *testing.T) {
	t.Parallel()
	err := &StackAuthorMissingErr{stackID: 7, authorName: "alice"}
	assert.Equal(t, "stack's 7 author alice is missing", err.Error())
}

func TestREQ_STK_03_RedeployWhenChanged_InactiveStackIsNoop(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID:     1,
		Status: portainer.StackStatusInactive,
		Name:   "paused",
	}))

	err := RedeployWhenChanged(t.Context(), 1, noopDeployer{}, store, testhelpers.NewGitService(nil, ""), nil)
	require.NoError(t, err)
}

func TestREQ_STK_03_RedeployWhenChanged_WebhookReturnsImmediately(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)

	admin := &portainer.User{Username: "admin", Role: portainer.AdministratorRole}
	require.NoError(t, store.User().Create(admin))
	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{ID: 1}))
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID:         2,
		Name:       "hooked",
		CreatedBy:  admin.Username,
		EndpointID: 1,
		// no WorkflowID → redeployWhenChanged returns nil inside the goroutine
		AutoUpdate: &portainer.AutoUpdateSettings{Webhook: "wh-token"},
	}))

	err := RedeployWhenChanged(context.Background(), 2, noopDeployer{}, store, testhelpers.NewGitService(nil, ""), nil)
	require.NoError(t, err)
}

func Test_isEnvironmentOnline_LocalDocker(t *testing.T) {
	t.Parallel()

	assert.True(t, isEnvironmentOnline(&portainer.Endpoint{Type: portainer.DockerEnvironment}))
	assert.True(t, isEnvironmentOnline(&portainer.Endpoint{Type: portainer.EdgeAgentOnDockerEnvironment}))
}

func Test_getUnpackerImage(t *testing.T) {
	t.Setenv(composeUnpackerImageEnvVar, "")
	assert.Equal(t, defaultUnpackerImage, getUnpackerImage())

	t.Setenv(composeUnpackerImageEnvVar, "custom/unpacker:dev")
	assert.Equal(t, "custom/unpacker:dev", getUnpackerImage())
}

func Test_getTargetSocketBindHostAndContainer(t *testing.T) {
	t.Parallel()

	assert.Equal(t, "//./pipe/docker_engine", getTargetSocketBindHost("windows", portainer.ContainerEngineDocker))
	assert.Equal(t, "/var/run/docker.sock", getTargetSocketBindHost("linux", portainer.ContainerEngineDocker))
	assert.Equal(t, "/run/podman/podman.sock", getTargetSocketBindHost("linux", portainer.ContainerEnginePodman))

	assert.Equal(t, "//./pipe/docker_engine", getTargetSocketBindContainer("windows"))
	assert.Equal(t, "/var/run/docker.sock", getTargetSocketBindContainer("LINUX"))
}

func Test_isNotInASwarm(t *testing.T) {
	t.Parallel()

	assert.True(t, isNotInASwarm(&system.Info{Swarm: swarm.Info{LocalNodeState: swarm.LocalNodeStateInactive}}))
	assert.False(t, isNotInASwarm(&system.Info{Swarm: swarm.Info{LocalNodeState: swarm.LocalNodeStateActive}}))
}
