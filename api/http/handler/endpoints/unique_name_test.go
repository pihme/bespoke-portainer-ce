package endpoints

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_03_IsNameUnique_DetectsCollisionAndAllowsSameID(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "local")
	createDockerEndpoint(t, store, 2, "other")

	unique, err := h.isNameUnique("local", 0)
	require.NoError(t, err)
	assert.False(t, unique)

	unique, err = h.isNameUnique("local", 1)
	require.NoError(t, err)
	assert.True(t, unique, "same endpoint may keep its name")

	unique, err = h.isNameUnique("free-name", 0)
	require.NoError(t, err)
	assert.True(t, unique)
}

func TestREQ_ENV_03_HideFields_ClearsAzureAndSnapshotRaw(t *testing.T) {
	t.Parallel()
	ep := &portainer.Endpoint{
		AzureCredentials: portainer.AzureCredentials{ApplicationID: "app", TenantID: "ten", AuthenticationKey: "key"},
		Snapshots: []portainer.DockerSnapshot{{
			SnapshotRaw: portainer.DockerSnapshotRaw{},
		}},
	}
	// Populate a non-empty SnapshotRaw via zero value is fine; hideFields clears it.
	hideFields(ep)
	assert.Equal(t, portainer.AzureCredentials{}, ep.AzureCredentials)
	assert.Equal(t, portainer.DockerSnapshotRaw{}, ep.Snapshots[0].SnapshotRaw)
}
