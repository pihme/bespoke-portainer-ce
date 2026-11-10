package workflows

import (
	"testing"

	portainer "github.com/portainer/portainer/api"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStackLastSyncDate(t *testing.T) {
	t.Parallel()

	t.Run("no deployment status", func(t *testing.T) {
		t.Parallel()
		assert.Equal(t, int64(0), StackLastSyncDate(portainer.Stack{}))
	})

	t.Run("no active entry", func(t *testing.T) {
		t.Parallel()
		s := portainer.Stack{DeploymentStatus: []portainer.StackDeploymentStatus{
			{Status: portainer.StackStatusDeploying, Time: 100},
		}}
		assert.Equal(t, int64(0), StackLastSyncDate(s))
	})

	t.Run("last entry is active", func(t *testing.T) {
		t.Parallel()
		s := portainer.Stack{DeploymentStatus: []portainer.StackDeploymentStatus{
			{Status: portainer.StackStatusDeploying, Time: 50},
			{Status: portainer.StackStatusActive, Time: 100},
		}}
		assert.Equal(t, int64(100), StackLastSyncDate(s))
	})

	t.Run("active followed by non-active returns the active time", func(t *testing.T) {
		t.Parallel()
		s := portainer.Stack{DeploymentStatus: []portainer.StackDeploymentStatus{
			{Status: portainer.StackStatusActive, Time: 100},
			{Status: portainer.StackStatusDeploying, Time: 200},
		}}
		assert.Equal(t, int64(100), StackLastSyncDate(s))
	})
}

func TestPlatformFromStackType(t *testing.T) {
	t.Parallel()

	require.Equal(t, DeploymentPlatformKubernetes, platformFromStackType(portainer.KubernetesStack))
	require.Equal(t, DeploymentPlatformDockerSwarm, platformFromStackType(portainer.DockerSwarmStack))
	require.Equal(t, DeploymentPlatformDockerStandalone, platformFromStackType(portainer.DockerComposeStack))
	require.Equal(t, DeploymentPlatformDockerStandalone, platformFromStackType(portainer.StackType(99)))
}
