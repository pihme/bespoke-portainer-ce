package docker

import (
	"testing"

	"github.com/portainer/portainer/api/docker/consts"
	"github.com/portainer/portainer/api/stacks/stackutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_getUniqueElements(t *testing.T) {
	t.Parallel()
	cases := []struct {
		description string
		input       string
		expected    []string
	}{
		{
			description: "no items padded",
			input:       "    ",
			expected:    []string{},
		},
		{
			description: "single item",
			input:       "a",
			expected:    []string{"a"},
		},
		{
			description: "single item padded",
			input:       " a   ",
			expected:    []string{"a"},
		},
		{
			description: "multiple items",
			input:       "a,b",
			expected:    []string{"a", "b"},
		},
		{
			description: "multiple items padded",
			input:       " a , b  ",
			expected:    []string{"a", "b"},
		},
		{
			description: "multiple items with empty values",
			input:       " a , ,b  ",
			expected:    []string{"a", "b"},
		},
		{
			description: "duplicates",
			input:       " a , a  ",
			expected:    []string{"a"},
		},
		{
			description: "mix with duplicates",
			input:       " a ,b, a  ",
			expected:    []string{"a", "b"},
		},
	}

	for _, tt := range cases {
		t.Run(tt.description, func(t *testing.T) {
			result := getUniqueElements(tt.input)
			assert.ElementsMatch(t, result, tt.expected)
		})
	}
}

func TestREQ_VOL_01_GetStackResourceIDFromLabels(t *testing.T) {
	t.Parallel()

	require.Equal(t, "", getStackResourceIDFromLabels(nil, 1))
	require.Equal(t, "", getStackResourceIDFromLabels(map[string]string{}, 1))

	swarm := getStackResourceIDFromLabels(map[string]string{
		consts.SwarmStackNameLabel: "swarm-app",
	}, 7)
	require.Equal(t, stackutils.ResourceControlID(7, "swarm-app"), swarm)

	compose := getStackResourceIDFromLabels(map[string]string{
		consts.ComposeStackNameLabel: "compose-app",
	}, 3)
	require.Equal(t, stackutils.ResourceControlID(3, "compose-app"), compose)

	// Swarm label wins when both are present
	both := getStackResourceIDFromLabels(map[string]string{
		consts.SwarmStackNameLabel:   "swarm-app",
		consts.ComposeStackNameLabel: "compose-app",
	}, 1)
	require.Equal(t, stackutils.ResourceControlID(1, "swarm-app"), both)
}
