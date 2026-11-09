package libpolicy_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/pkg/libpolicy"

	"github.com/stretchr/testify/require"
)

func TestConfigFingerprintDeterministic(t *testing.T) {
	t.Parallel()
	a := libpolicy.ConfigFingerprint([]byte(`{"charts":[]}`))
	b := libpolicy.ConfigFingerprint([]byte(`{"charts":[]}`))
	require.Equal(t, a, b)
	require.NotEmpty(t, a)

	different := libpolicy.ConfigFingerprint([]byte(`{"charts":[{"ChartName":"a"}]}`))
	require.NotEqual(t, a, different)
}

func TestHelmPolicyFingerprintOrderIndependent(t *testing.T) {
	t.Parallel()
	left := []portainer.PolicyChartSummary{
		{ChartName: "nginx", Fingerprint: "a"},
		{ChartName: "redis", Fingerprint: "b"},
	}
	right := []portainer.PolicyChartSummary{
		{ChartName: "redis", Fingerprint: "b"},
		{ChartName: "nginx", Fingerprint: "a"},
	}
	require.Equal(t, libpolicy.HelmPolicyFingerprint(left), libpolicy.HelmPolicyFingerprint(right))
	require.NotEmpty(t, libpolicy.HelmPolicyFingerprint(left))

	require.NotEmpty(t, libpolicy.HelmPolicyFingerprint(nil))
	require.NotEmpty(t, libpolicy.HelmPolicyFingerprint([]portainer.PolicyChartSummary{{ChartName: "only"}}))

	changed := []portainer.PolicyChartSummary{
		{ChartName: "nginx", Fingerprint: "a2"},
		{ChartName: "redis", Fingerprint: "b"},
	}
	require.NotEqual(t, libpolicy.HelmPolicyFingerprint(left), libpolicy.HelmPolicyFingerprint(changed))
}
