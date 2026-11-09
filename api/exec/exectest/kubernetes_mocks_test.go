package exectest

import (
	"context"
	"testing"

	portainer "github.com/portainer/portainer/api"

	"github.com/stretchr/testify/require"
)

func TestNewKubernetesDeployer_MockMethods(t *testing.T) {
	t.Parallel()

	deployer := NewKubernetesDeployer()
	require.NotNil(t, deployer)

	endpoint := &portainer.Endpoint{ID: 1}
	ctx := context.Background()

	out, err := deployer.Deploy(ctx, 1, endpoint, []string{"manifest.yml"}, "default")
	require.NoError(t, err)
	require.Empty(t, out)

	out, err = deployer.Remove(ctx, 1, endpoint, []string{"manifest.yml"}, "default")
	require.NoError(t, err)
	require.Empty(t, out)

	out, err = deployer.Restart(ctx, 1, endpoint, []string{"manifest.yml"}, "default")
	require.NoError(t, err)
	require.Empty(t, out)
}
