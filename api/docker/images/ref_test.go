package images

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestREQ_IMG_02_ParseReference(t *testing.T) {
	t.Parallel()

	ref, err := ParseReference("docker.io/library/nginx:latest")
	require.NoError(t, err)
	require.NotNil(t, ref)
	require.Equal(t, "docker.io/library/nginx:latest", ref.DockerReference().String())

	ref2, err := ParseReference("//quay.io/prometheus/node-exporter:v1.0.0")
	require.NoError(t, err)
	require.NotNil(t, ref2)
	require.Equal(t, "quay.io/prometheus/node-exporter:v1.0.0", ref2.DockerReference().String())

	_, err = ParseReference("://bad")
	require.Error(t, err)
}
