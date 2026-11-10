package endpoints

import (
	"testing"

	portainer "github.com/portainer/portainer/api"

	"github.com/stretchr/testify/require"
)

func TestIsLocalEndpoint_UnixAndNpipe(t *testing.T) {
	t.Parallel()
	require.True(t, IsLocalEndpoint(&portainer.Endpoint{URL: "unix:///var/run/docker.sock"}))
	require.True(t, IsLocalEndpoint(&portainer.Endpoint{URL: "npipe:////./pipe/docker_engine"}))
	require.True(t, IsLocalEndpoint(&portainer.Endpoint{Type: portainer.KubernetesLocalEnvironment}))
	require.False(t, IsLocalEndpoint(&portainer.Endpoint{URL: "tcp://127.0.0.1:2375", Type: portainer.DockerEnvironment}))
}

func TestIsDockerEndpoint_LocalTypes(t *testing.T) {
	t.Parallel()
	require.True(t, IsDockerEndpoint(&portainer.Endpoint{Type: portainer.DockerEnvironment}))
	require.True(t, IsDockerEndpoint(&portainer.Endpoint{Type: portainer.AgentOnDockerEnvironment}))
	require.True(t, IsDockerEndpoint(&portainer.Endpoint{Type: portainer.EdgeAgentOnDockerEnvironment}))
	require.False(t, IsDockerEndpoint(&portainer.Endpoint{Type: portainer.AzureEnvironment}))
}

func TestIsKubernetesEndpoint(t *testing.T) {
	t.Parallel()
	require.True(t, IsKubernetesEndpoint(&portainer.Endpoint{Type: portainer.KubernetesLocalEnvironment}))
	require.True(t, IsKubernetesEndpoint(&portainer.Endpoint{Type: portainer.AgentOnKubernetesEnvironment}))
	require.True(t, IsKubernetesEndpoint(&portainer.Endpoint{Type: portainer.EdgeAgentOnKubernetesEnvironment}))
	require.False(t, IsKubernetesEndpoint(&portainer.Endpoint{Type: portainer.DockerEnvironment}))
}

func TestIsAgentEndpoint(t *testing.T) {
	t.Parallel()
	require.True(t, IsAgentEndpoint(&portainer.Endpoint{Type: portainer.AgentOnDockerEnvironment}))
	require.True(t, IsAgentEndpoint(&portainer.Endpoint{Type: portainer.EdgeAgentOnDockerEnvironment}))
	require.True(t, IsAgentEndpoint(&portainer.Endpoint{Type: portainer.AgentOnKubernetesEnvironment}))
	require.True(t, IsAgentEndpoint(&portainer.Endpoint{Type: portainer.EdgeAgentOnKubernetesEnvironment}))
	require.False(t, IsAgentEndpoint(&portainer.Endpoint{Type: portainer.DockerEnvironment}))
}
