package libstack

import (
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPortainerEnvVars(t *testing.T) {
	t.Setenv("PORTAINER_TEST_FLAG", "1")
	t.Setenv("OTHER_VAR", "x")
	vars := PortainerEnvVars()
	require.Contains(t, vars, "PORTAINER_TEST_FLAG=1")
	for _, v := range vars {
		require.True(t, len(v) >= len(PortainerEnvVarsPrefix))
		require.Equal(t, PortainerEnvVarsPrefix, v[:len(PortainerEnvVarsPrefix)])
	}
	_ = os.Getenv
}

func TestAggregateStatusCounts(t *testing.T) {
	t.Parallel()
	require.Equal(t, StatusError, AggregateStatusCounts(map[Status]int{StatusError: 1, StatusRunning: 2}, 3))
	require.Equal(t, StatusStarting, AggregateStatusCounts(map[Status]int{StatusStarting: 1, StatusRunning: 1}, 2))
	require.Equal(t, StatusRemoving, AggregateStatusCounts(map[Status]int{StatusRemoving: 1}, 1))
	require.Equal(t, StatusCompleted, AggregateStatusCounts(map[Status]int{StatusCompleted: 2}, 2))
	require.Equal(t, StatusRunning, AggregateStatusCounts(map[Status]int{StatusRunning: 1, StatusCompleted: 1}, 2))
	require.Equal(t, StatusStopped, AggregateStatusCounts(map[Status]int{StatusStopped: 3}, 3))
	require.Equal(t, StatusRemoved, AggregateStatusCounts(map[Status]int{StatusRemoved: 1}, 1))
	require.Equal(t, StatusUnknown, AggregateStatusCounts(map[Status]int{StatusRunning: 1}, 3))
}
