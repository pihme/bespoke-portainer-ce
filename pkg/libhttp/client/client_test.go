package client

import (
	"testing"

	"github.com/portainer/portainer/pkg/featureflags"
	"github.com/stretchr/testify/require"
)

func TestExternalRequestDisabled_FlagOff(t *testing.T) {
	featureflags.Parse(nil, []featureflags.Feature{DisableExternalRequests})
	t.Cleanup(func() { featureflags.Parse(nil, nil) })

	require.NoError(t, ExternalRequestDisabled("https://example.com"))
}

func TestExternalRequestDisabled_FlagOn(t *testing.T) {
	featureflags.Parse([]string{string(DisableExternalRequests)}, []featureflags.Feature{DisableExternalRequests})
	t.Cleanup(func() { featureflags.Parse(nil, nil) })

	err := ExternalRequestDisabled("https://example.com")
	require.ErrorIs(t, err, ErrExternalRequestsBlocked)
}
