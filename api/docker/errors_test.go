package docker

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestErrUnableToPingEndpoint_Message(t *testing.T) {
	t.Parallel()

	require.EqualError(t, ErrUnableToPingEndpoint, "Unable to communicate with the environment")
}
