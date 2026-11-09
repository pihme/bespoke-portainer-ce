package sources

import (
	"testing"

	portainer "github.com/portainer/portainer/api"

	"github.com/stretchr/testify/require"
)

func TestStatusString(t *testing.T) {
	t.Parallel()
	require.Equal(t, SourceStatusHealthy, StatusString(portainer.SourceStatusHealthy))
	require.Equal(t, SourceStatusError, StatusString(portainer.SourceStatusError))
	require.Equal(t, SourceStatusUnknown, StatusString(portainer.SourceStatus(0)))
	require.Equal(t, SourceStatusUnknown, StatusString(portainer.SourceStatus(99)))
}
