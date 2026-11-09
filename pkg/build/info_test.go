package build

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetBuildInfo(t *testing.T) {
	t.Parallel()

	BuildNumber = "42"
	ImageTag = "tag"
	NodejsVersion = "20"
	PnpmVersion = "9"
	WebpackVersion = "5"
	GoVersion = "1.24"
	GitCommit = "abc"

	info := GetBuildInfo()
	require.Equal(t, "42", info.BuildNumber)
	require.Equal(t, "tag", info.ImageTag)
	require.Equal(t, "20", info.NodejsVersion)
	require.Equal(t, "9", info.PnpmVersion)
	require.Equal(t, "5", info.WebpackVersion)
	require.Equal(t, "1.24", info.GoVersion)
	require.Equal(t, "abc", info.GitCommit)
}

func TestGetDependenciesInfo(t *testing.T) {
	t.Parallel()

	DepDockerVersion = "docker"
	DepComposeVersion = "compose"
	DepKubectlVersion = "kubectl"
	DepHelmVersion = "helm"

	info := GetDependenciesInfo()
	require.Equal(t, "docker", info.DockerVersion)
	require.Equal(t, "compose", info.ComposeVersion)
	require.Equal(t, "kubectl", info.KubectlVersion)
	require.Equal(t, "helm", info.HelmVersion)
}

func TestGetRuntimeInfo(t *testing.T) {
	t.Parallel()

	info := GetRuntimeInfo()
	require.NotEmpty(t, info.Env)
}
