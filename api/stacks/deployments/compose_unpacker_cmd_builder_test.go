package deployments

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	gittypes "github.com/portainer/portainer/api/git/types"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func sampleComposeStack() *portainer.Stack {
	return &portainer.Stack{
		Name:            "web",
		EntryPoint:      "docker-compose.yml",
		AdditionalFiles: []string{"docker-compose.override.yml"},
		Env: []portainer.Pair{
			{Name: "FOO", Value: "bar"},
		},
	}
}

func sampleGitConfig(auth bool, skipTLS bool) *gittypes.RepoConfig {
	gc := &gittypes.RepoConfig{
		URL:            "https://example.com/repo.git",
		ReferenceName:  "refs/heads/main",
		TLSSkipVerify:  skipTLS,
		ConfigFilePath: "docker-compose.yml",
	}
	if auth {
		gc.Authentication = &gittypes.GitAuthentication{
			Username: "gituser",
			Password: "gitpass",
		}
	}
	return gc
}

func TestREQ_STK_02_BuildDeployCmd_ComposeFlagsAndArgs(t *testing.T) {
	t.Parallel()

	stack := sampleComposeStack()
	opts := unpackerCmdBuilderOptions{
		gitConfig:          sampleGitConfig(true, true),
		forceRecreate:      true,
		prune:              true,
		composeDestination: "/data/compose",
		registries:         nil,
	}
	registries := []string{"--registry=u:p:reg.example"}
	env := getEnv(stack.Env)

	cmd := buildDeployCmd(stack, opts, registries, env)

	assert.Equal(t, UnpackerCmdDeploy, cmd[0])
	assert.Contains(t, cmd, "-u")
	assert.Contains(t, cmd, "gituser")
	assert.Contains(t, cmd, "-p")
	assert.Contains(t, cmd, "gitpass")
	assert.Contains(t, cmd, "--skip-tls-verify")
	assert.Contains(t, cmd, "--force-recreate")
	assert.Contains(t, cmd, "-r")
	assert.Contains(t, cmd, "--env=FOO=bar")
	assert.Contains(t, cmd, "--registry=u:p:reg.example")
	assert.Contains(t, cmd, opts.gitConfig.URL)
	assert.Contains(t, cmd, opts.gitConfig.ReferenceName)
	assert.Contains(t, cmd, stack.Name)
	assert.Contains(t, cmd, opts.composeDestination)
	assert.Contains(t, cmd, stack.EntryPoint)
	assert.Contains(t, cmd, stack.AdditionalFiles[0])
}

func TestREQ_STK_08_BuildUndeployCmd_ComposeArgs(t *testing.T) {
	t.Parallel()

	stack := sampleComposeStack()
	opts := unpackerCmdBuilderOptions{
		gitConfig:          sampleGitConfig(false, false),
		composeDestination: "/data/compose",
	}

	cmd := buildUndeployCmd(stack, opts, nil, nil)

	assert.Equal(t, UnpackerCmdUndeploy, cmd[0])
	assert.NotContains(t, cmd, "-u")
	assert.Contains(t, cmd, opts.gitConfig.URL)
	assert.Contains(t, cmd, stack.Name)
	assert.Contains(t, cmd, opts.composeDestination)
	assert.Contains(t, cmd, stack.EntryPoint)
	assert.Contains(t, cmd, stack.AdditionalFiles[0])
}

func TestREQ_STK_05_BuildComposeStartAndStopCmd(t *testing.T) {
	t.Parallel()

	stack := sampleComposeStack()
	opts := unpackerCmdBuilderOptions{
		gitConfig:          sampleGitConfig(true, true),
		composeDestination: "/data/compose",
	}
	env := getEnv(stack.Env)

	start := buildComposeStartCmd(stack, opts, []string{"--registry=a:b:c"}, env)
	assert.Equal(t, UnpackerCmdDeploy, start[0])
	assert.Contains(t, start, "-k")
	assert.Contains(t, start, "--skip-tls-verify")
	assert.Contains(t, start, "--env=FOO=bar")
	assert.Contains(t, start, "--registry=a:b:c")
	assert.Contains(t, start, opts.gitConfig.ReferenceName)

	stop := buildComposeStopCmd(stack, opts, nil, nil)
	assert.Equal(t, UnpackerCmdUndeploy, stop[0])
	assert.Contains(t, stop, "-k")
	assert.Contains(t, stop, opts.gitConfig.URL)
	assert.Contains(t, stop, stack.Name)
}

func TestREQ_STK_02_BuildUnpackerCmdForStack_ComposeOperations(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	deployer := NewStackDeployer(nil, nil, nil, nil, store)

	stack := sampleComposeStack()
	opts := unpackerCmdBuilderOptions{
		gitConfig:          sampleGitConfig(false, false),
		composeDestination: "/tmp/dest",
		prune:              true,
	}

	deployCmd, err := deployer.buildUnpackerCmdForStack(stack, OperationDeploy, opts)
	require.NoError(t, err)
	assert.Equal(t, UnpackerCmdDeploy, deployCmd[0])
	assert.Contains(t, deployCmd, "-r")

	undeployCmd, err := deployer.buildUnpackerCmdForStack(stack, OperationUndeploy, opts)
	require.NoError(t, err)
	assert.Equal(t, UnpackerCmdUndeploy, undeployCmd[0])

	startCmd, err := deployer.buildUnpackerCmdForStack(stack, OperationComposeStart, opts)
	require.NoError(t, err)
	assert.Contains(t, startCmd, "-k")

	stopCmd, err := deployer.buildUnpackerCmdForStack(stack, OperationComposeStop, opts)
	require.NoError(t, err)
	assert.Contains(t, stopCmd, "-k")
}

func Test_buildUnpackerCmdForStack_UnknownOperation(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	deployer := NewStackDeployer(nil, nil, nil, nil, store)

	_, err := deployer.buildUnpackerCmdForStack(sampleComposeStack(), StackRemoteOperation("no-such-op"), unpackerCmdBuilderOptions{
		gitConfig: sampleGitConfig(false, false),
	})
	require.ErrorContains(t, err, "unknown stack operation")
}

func Test_appendGitAuthIfNeeded(t *testing.T) {
	t.Parallel()

	base := []string{"deploy"}

	assert.Equal(t, base, appendGitAuthIfNeeded(base, nil))
	assert.Equal(t, base, appendGitAuthIfNeeded(base, &gittypes.RepoConfig{}))
	assert.Equal(t, base, appendGitAuthIfNeeded(base, &gittypes.RepoConfig{
		Authentication: &gittypes.GitAuthentication{Username: "u"},
	}))

	withAuth := appendGitAuthIfNeeded(base, sampleGitConfig(true, false))
	assert.Equal(t, []string{"deploy", "-u", "gituser", "-p", "gitpass"}, withAuth)
}

func Test_appendSkipTLSVerifyIfNeeded(t *testing.T) {
	t.Parallel()

	base := []string{"deploy"}
	assert.Equal(t, base, appendSkipTLSVerifyIfNeeded(base, nil))
	assert.Equal(t, base, appendSkipTLSVerifyIfNeeded(base, &gittypes.RepoConfig{}))
	assert.Equal(t, []string{"deploy", "--skip-tls-verify"}, appendSkipTLSVerifyIfNeeded(base, sampleGitConfig(false, true)))
}

func Test_appendForceRecreateIfNeeded(t *testing.T) {
	t.Parallel()

	base := []string{"deploy"}
	assert.Equal(t, base, appendForceRecreateIfNeeded(base, false))
	assert.Equal(t, []string{"deploy", "--force-recreate"}, appendForceRecreateIfNeeded(base, true))
}

func Test_getEnv(t *testing.T) {
	t.Parallel()

	assert.Nil(t, getEnv(nil))
	assert.Nil(t, getEnv([]portainer.Pair{}))
	assert.Equal(t, []string{"--env=A=1", "--env=B=2"}, getEnv([]portainer.Pair{
		{Name: "A", Value: "1"},
		{Name: "B", Value: "2"},
	}))
}

func TestREQ_STK_02_GenerateRegistriesStrings(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)

	assert.Empty(t, generateRegistriesStrings(nil, store))
	assert.Empty(t, generateRegistriesStrings([]portainer.Registry{
		{Name: "anon", Authentication: false, URL: "reg.example"},
	}, store))

	authed := []portainer.Registry{
		{
			Name:           "private",
			Type:           portainer.CustomRegistry,
			Authentication: true,
			Username:       "user",
			Password:       "secret",
			URL:            "reg.example",
		},
	}
	got := generateRegistriesStrings(authed, store)
	require.Len(t, got, 1)
	assert.Equal(t, "--registry=user:secret:reg.example", got[0])
}
