package status

import (
	"testing"

	portainer "github.com/portainer/portainer/api"

	"github.com/stretchr/testify/require"
)

func TestNodesCount_LocalDockerSnapshot(t *testing.T) {
	t.Parallel()
	endpoints := []portainer.Endpoint{
		{
			ID:   1,
			Type: portainer.DockerEnvironment,
			URL:  "unix:///var/run/docker.sock",
			Snapshots: []portainer.DockerSnapshot{
				{NodeCount: 1},
			},
		},
		{
			ID:   2,
			Type: portainer.DockerEnvironment,
			URL:  "tcp://127.0.0.1:2375",
			// No snapshot → countNodes returns 1.
		},
	}
	require.Equal(t, 2, NodesCount(endpoints))
}

func TestNodesCount_SkipsUntrustedEdge(t *testing.T) {
	t.Parallel()
	endpoints := []portainer.Endpoint{
		{
			ID:          1,
			Type:        portainer.EdgeAgentOnDockerEnvironment,
			UserTrusted: false,
			Snapshots:   []portainer.DockerSnapshot{{NodeCount: 5}},
		},
		{
			ID:          2,
			Type:        portainer.EdgeAgentOnDockerEnvironment,
			UserTrusted: true,
			Snapshots:   []portainer.DockerSnapshot{{NodeCount: 3}},
		},
	}
	// Untrusted edge is skipped; trusted edge still counted (not Swarm inventory).
	require.Equal(t, 3, NodesCount(endpoints))
}

func TestCountNodes_DockerAndDefault(t *testing.T) {
	t.Parallel()
	require.Equal(t, 4, countNodes(&portainer.Endpoint{
		Snapshots: []portainer.DockerSnapshot{{NodeCount: 4}},
	}))
	require.Equal(t, 1, countNodes(&portainer.Endpoint{
		Snapshots: []portainer.DockerSnapshot{{NodeCount: 0}},
	}))
	require.Equal(t, 1, countNodes(&portainer.Endpoint{}))
}

func TestCountNodes_KubernetesSnapshotDeferredShape(t *testing.T) {
	t.Parallel()
	// Kubernetes snapshot arm exists on the helper; exercise it so leftover
	// coverage is not an unread path, while Priority still treats Swarm/K8s
	// inventory as out of local-Docker scope.
	require.Equal(t, 2, countNodes(&portainer.Endpoint{
		Kubernetes: portainer.KubernetesData{
			Snapshots: []portainer.KubernetesSnapshot{{NodeCount: 2}},
		},
	}))
}
