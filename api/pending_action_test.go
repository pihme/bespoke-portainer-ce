package portainer

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPendingActionMarshalAndUnmarshalActionData(t *testing.T) {
	t.Parallel()
	pa := PendingAction{
		ID:         1,
		EndpointID: 7,
		Action:     "local-docker-migrate",
		ActionData: map[string]any{"folder": "compose"},
		CreatedAt:  123,
	}
	raw, err := json.Marshal(pa)
	require.NoError(t, err)

	var decoded map[string]any
	require.NoError(t, json.Unmarshal(raw, &decoded))
	require.Equal(t, "local-docker-migrate", decoded["Action"])
	require.IsType(t, "", decoded["ActionData"])

	pa2 := PendingAction{ActionData: decoded["ActionData"]}
	var payload map[string]string
	require.NoError(t, pa2.UnmarshallActionData(&payload))
	require.Equal(t, "compose", payload["folder"])

	pa3 := PendingAction{ActionData: 42}
	require.NoError(t, pa3.UnmarshallActionData(&payload))
}

func TestGetEditionLabelAndDefaultSecuritySettings(t *testing.T) {
	t.Parallel()
	require.Equal(t, "CE", PortainerCE.GetEditionLabel())
	require.Equal(t, "BE", PortainerBE.GetEditionLabel())
	require.Equal(t, "EE", PortainerEE.GetEditionLabel())
	require.Equal(t, "CE", SoftwareEdition(99).GetEditionLabel())

	settings := DefaultEndpointSecuritySettings()
	require.False(t, settings.AllowBindMountsForRegularUsers)
	require.False(t, settings.AllowPrivilegedModeForRegularUsers)
}

func TestEdgeStackStatusTypeString(t *testing.T) {
	t.Parallel()
	require.Contains(t, EdgeStackStatusRunning.String(), "Running")
	require.Contains(t, EdgeStackStatusType(999).String(), "UNKNOWN")
}

func TestKubernetesDefaultDeferredShape(t *testing.T) {
	t.Parallel()
	// Deferred-within-package (Kubernetes): still assert observed defaults so the
	// constructor statements are counted without expanding into K8s behaviour.
	got := KubernetesDefault()
	require.True(t, got.Configuration.EnableResourceOverCommit)
	require.False(t, got.Configuration.UseLoadBalancer)
	require.Empty(t, got.Snapshots)
}
