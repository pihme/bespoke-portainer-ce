package docker

import (
	"testing"

	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/api/types/system"
	"github.com/stretchr/testify/require"
)

// TestREQ_VOL_01_EngineID_UsesEngineIDForStandalone matches Transport.getDockerID:
// a standalone Docker engine uses Info.ID for volume ResourceControl keys.
func TestREQ_VOL_01_EngineID_UsesEngineIDForStandalone(t *testing.T) {
	t.Parallel()

	require.Equal(t, "engine-abc", EngineID(system.Info{ID: "engine-abc"}))
}

// TestREQ_VOL_01_EngineID_UsesSwarmClusterIDWhenPresent keeps volume RC keys
// consistent with a Swarm cluster's Cluster.ID when the snapshot is from Swarm.
func TestREQ_VOL_01_EngineID_UsesSwarmClusterIDWhenPresent(t *testing.T) {
	t.Parallel()

	info := system.Info{
		ID: "node-local-id",
		Swarm: swarm.Info{
			Cluster: &swarm.ClusterInfo{ID: "swarm-cluster-42"},
		},
	}
	require.Equal(t, "swarm-cluster-42", EngineID(info))
}
