package exec

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/http/proxy"
	"github.com/portainer/portainer/pkg/libstack"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// recordingComposeDeployer records libstack.Deployer calls used by ComposeStackManager.
type recordingComposeDeployer struct {
	deployCalls int
	runCalls    int
	removeCalls int
	pullCalls   int

	lastDeployOpts libstack.DeployOptions
	lastRunOpts    libstack.RunOptions
	lastRunService string
	lastRemoveName string
	lastRemoveOpts libstack.RemoveOptions
	lastPullOpts   libstack.Options
	lastFilePaths  []string

	deployErr error
	runErr    error
	removeErr error
	pullErr   error
}

func (d *recordingComposeDeployer) Deploy(_ context.Context, filePaths []string, options libstack.DeployOptions) error {
	d.deployCalls++
	d.lastFilePaths = append([]string(nil), filePaths...)
	d.lastDeployOpts = options
	return d.deployErr
}

func (d *recordingComposeDeployer) Remove(_ context.Context, projectName string, _ []string, options libstack.RemoveOptions) error {
	d.removeCalls++
	d.lastRemoveName = projectName
	d.lastRemoveOpts = options
	return d.removeErr
}

func (d *recordingComposeDeployer) Pull(_ context.Context, filePaths []string, options libstack.Options) error {
	d.pullCalls++
	d.lastFilePaths = append([]string(nil), filePaths...)
	d.lastPullOpts = options
	return d.pullErr
}

func (d *recordingComposeDeployer) Run(_ context.Context, filePaths []string, serviceName string, options libstack.RunOptions) error {
	d.runCalls++
	d.lastFilePaths = append([]string(nil), filePaths...)
	d.lastRunService = serviceName
	d.lastRunOpts = options
	return d.runErr
}

func (d *recordingComposeDeployer) Validate(context.Context, []string, libstack.Options) error {
	return nil
}

func (d *recordingComposeDeployer) WaitForStatus(context.Context, string, libstack.Status) libstack.WaitResult {
	return libstack.WaitResult{}
}

func (d *recordingComposeDeployer) Config(context.Context, []string, libstack.Options) ([]byte, error) {
	return nil, nil
}

func (d *recordingComposeDeployer) GetExistingEdgeStacks(context.Context) ([]libstack.EdgeStack, error) {
	return nil, nil
}

func localUnixEndpoint() *portainer.Endpoint {
	return &portainer.Endpoint{URL: "unix:///var/run/docker.sock"}
}

func testComposeStack(t *testing.T, env []portainer.Pair) *portainer.Stack {
	t.Helper()
	dir := t.TempDir()
	entry := "docker-compose.yml"
	require.NoError(t, os.WriteFile(filepath.Join(dir, entry), []byte("services:\n  web:\n    image: alpine\n"), 0o600))
	return &portainer.Stack{
		Name:        "demo-stack",
		ProjectPath: dir,
		EntryPoint:  entry,
		Env:         env,
	}
}

func TestREQ_STK_02_ComposeStackManager_UpLocalDocker(t *testing.T) {
	t.Parallel()

	deployer := &recordingComposeDeployer{}
	manager := NewComposeStackManager(deployer, nil)
	stack := testComposeStack(t, []portainer.Pair{{Name: "FOO", Value: "bar"}})
	endpoint := localUnixEndpoint()

	err := manager.Up(t.Context(), stack, endpoint, portainer.ComposeUpOptions{
		ComposeOptions: portainer.ComposeOptions{
			Registries: []portainer.Registry{
				{URL: "registry.example.com", Username: "u", Password: "p", Authentication: false},
			},
		},
		ForceRecreate:        true,
		AbortOnContainerExit: true,
		Prune:                true,
	})
	require.NoError(t, err)
	assert.Equal(t, 1, deployer.deployCalls)
	assert.Equal(t, stack.Name, deployer.lastDeployOpts.ProjectName)
	assert.Equal(t, stack.ProjectPath, deployer.lastDeployOpts.WorkingDir)
	assert.Empty(t, deployer.lastDeployOpts.Host, "unix endpoint skips agent proxy")
	assert.True(t, deployer.lastDeployOpts.ForceRecreate)
	assert.True(t, deployer.lastDeployOpts.AbortOnContainerExit)
	assert.True(t, deployer.lastDeployOpts.RemoveOrphans)
	assert.NotEmpty(t, deployer.lastDeployOpts.EnvFilePath)
	assert.FileExists(t, deployer.lastDeployOpts.EnvFilePath)
	require.Len(t, deployer.lastDeployOpts.Registries, 1)
	assert.Equal(t, "registry.example.com", deployer.lastDeployOpts.Registries[0].ServerAddress)
	require.Len(t, deployer.lastFilePaths, 1)
	assert.Contains(t, deployer.lastFilePaths[0], "docker-compose.yml")
}

func TestREQ_STK_02_ComposeStackManager_UpDeployError(t *testing.T) {
	t.Parallel()

	deployer := &recordingComposeDeployer{deployErr: errors.New("compose up failed")}
	manager := NewComposeStackManager(deployer, nil)

	err := manager.Up(t.Context(), testComposeStack(t, nil), localUnixEndpoint(), portainer.ComposeUpOptions{})
	require.ErrorContains(t, err, "failed to deploy a stack")
	require.ErrorContains(t, err, "compose up failed")
}

func TestREQ_STK_02_ComposeStackManager_UpProxyError(t *testing.T) {
	t.Parallel()

	manager := NewComposeStackManager(&recordingComposeDeployer{}, &proxy.Manager{})
	endpoint := &portainer.Endpoint{URL: "tcp://remote.example:9001"}

	err := manager.Up(t.Context(), testComposeStack(t, nil), endpoint, portainer.ComposeUpOptions{})
	require.ErrorContains(t, err, "failed to fetch environment proxy")
}

func TestREQ_STK_02_ComposeStackManager_UpEnvFileError(t *testing.T) {
	t.Parallel()

	manager := NewComposeStackManager(&recordingComposeDeployer{}, nil)
	stack := &portainer.Stack{
		Name:        "bad-env",
		ProjectPath: filepath.Join(t.TempDir(), "missing", "path"),
		EntryPoint:  "compose.yml",
		Env:         []portainer.Pair{{Name: "A", Value: "1"}},
	}

	err := manager.Up(t.Context(), stack, localUnixEndpoint(), portainer.ComposeUpOptions{})
	require.ErrorContains(t, err, "failed to create env file")
}

func TestREQ_STK_02_ComposeStackManager_RunLocalDocker(t *testing.T) {
	t.Parallel()

	deployer := &recordingComposeDeployer{}
	manager := NewComposeStackManager(deployer, nil)
	stack := testComposeStack(t, nil)

	err := manager.Run(t.Context(), stack, localUnixEndpoint(), "web", portainer.ComposeRunOptions{
		ComposeOptions: portainer.ComposeOptions{
			Registries: []portainer.Registry{
				{URL: "reg.local", Authentication: false},
			},
		},
		Remove:   true,
		Args:     []string{"echo", "hi"},
		Detached: true,
	})
	require.NoError(t, err)
	assert.Equal(t, 1, deployer.runCalls)
	assert.Equal(t, "web", deployer.lastRunService)
	assert.Equal(t, stack.Name, deployer.lastRunOpts.ProjectName)
	assert.True(t, deployer.lastRunOpts.Remove)
	assert.True(t, deployer.lastRunOpts.Detached)
	assert.Equal(t, []string{"echo", "hi"}, deployer.lastRunOpts.Args)
	require.Len(t, deployer.lastRunOpts.Registries, 1)
}

func TestREQ_STK_02_ComposeStackManager_RunDeployError(t *testing.T) {
	t.Parallel()

	deployer := &recordingComposeDeployer{runErr: errors.New("compose run failed")}
	manager := NewComposeStackManager(deployer, nil)

	err := manager.Run(t.Context(), testComposeStack(t, nil), localUnixEndpoint(), "web", portainer.ComposeRunOptions{})
	require.ErrorContains(t, err, "failed to deploy a stack")
	require.ErrorContains(t, err, "compose run failed")
}

func TestREQ_STK_02_ComposeStackManager_RunProxyError(t *testing.T) {
	t.Parallel()

	manager := NewComposeStackManager(&recordingComposeDeployer{}, &proxy.Manager{})
	err := manager.Run(t.Context(), testComposeStack(t, nil), &portainer.Endpoint{URL: "tcp://remote.example:9001"}, "web", portainer.ComposeRunOptions{})
	require.ErrorContains(t, err, "failed to fetch environment proxy")
}

func TestREQ_STK_02_ComposeStackManager_PullLocalDocker(t *testing.T) {
	t.Parallel()

	deployer := &recordingComposeDeployer{}
	manager := NewComposeStackManager(deployer, nil)
	stack := testComposeStack(t, []portainer.Pair{{Name: "TAG", Value: "1"}})

	err := manager.Pull(t.Context(), stack, localUnixEndpoint(), portainer.ComposeOptions{
		Registries: []portainer.Registry{{URL: "hub.example", Authentication: false}},
	})
	require.NoError(t, err)
	assert.Equal(t, 1, deployer.pullCalls)
	assert.Equal(t, stack.Name, deployer.lastPullOpts.ProjectName)
	assert.Equal(t, stack.ProjectPath, deployer.lastPullOpts.WorkingDir)
	assert.NotEmpty(t, deployer.lastPullOpts.EnvFilePath)
	require.Len(t, deployer.lastPullOpts.Registries, 1)
}

func TestREQ_STK_02_ComposeStackManager_PullError(t *testing.T) {
	t.Parallel()

	deployer := &recordingComposeDeployer{pullErr: errors.New("pull failed")}
	manager := NewComposeStackManager(deployer, nil)

	err := manager.Pull(t.Context(), testComposeStack(t, nil), localUnixEndpoint(), portainer.ComposeOptions{})
	require.ErrorContains(t, err, "failed to pull images of the stack")
	require.ErrorContains(t, err, "pull failed")
}

func TestREQ_STK_02_ComposeStackManager_PullProxyError(t *testing.T) {
	t.Parallel()

	manager := NewComposeStackManager(&recordingComposeDeployer{}, &proxy.Manager{})
	err := manager.Pull(t.Context(), testComposeStack(t, nil), &portainer.Endpoint{URL: "tcp://remote.example:9001"}, portainer.ComposeOptions{})
	require.ErrorContains(t, err, "failed to fetch environment proxy")
}

func TestREQ_STK_08_ComposeStackManager_DownLocalDocker(t *testing.T) {
	t.Parallel()

	deployer := &recordingComposeDeployer{}
	manager := NewComposeStackManager(deployer, nil)
	stack := &portainer.Stack{Name: "remove-me", ProjectPath: t.TempDir()}

	err := manager.Down(t.Context(), stack, localUnixEndpoint())
	require.NoError(t, err)
	assert.Equal(t, 1, deployer.removeCalls)
	assert.Equal(t, "remove-me", deployer.lastRemoveName)
	assert.Empty(t, deployer.lastRemoveOpts.Host)
	assert.Empty(t, deployer.lastRemoveOpts.WorkingDir)
}

func TestREQ_STK_08_ComposeStackManager_DownRemoveError(t *testing.T) {
	t.Parallel()

	deployer := &recordingComposeDeployer{removeErr: errors.New("remove failed")}
	manager := NewComposeStackManager(deployer, nil)

	err := manager.Down(t.Context(), &portainer.Stack{Name: "x"}, localUnixEndpoint())
	require.ErrorContains(t, err, "failed to remove a stack")
	require.ErrorContains(t, err, "remove failed")
}

func TestREQ_STK_08_ComposeStackManager_DownProxyError(t *testing.T) {
	t.Parallel()

	manager := NewComposeStackManager(&recordingComposeDeployer{}, &proxy.Manager{})
	err := manager.Down(t.Context(), &portainer.Stack{Name: "x"}, &portainer.Endpoint{URL: "tcp://remote.example:9001"})
	require.ErrorContains(t, err, "failed to fetch environment proxy")
}

func TestREQ_STK_02_ComposeStackManager_NormalizeAndSyntaxVersion(t *testing.T) {
	t.Parallel()

	manager := NewComposeStackManager(&recordingComposeDeployer{}, nil)
	assert.Equal(t, portainer.ComposeSyntaxMaxVersion, manager.ComposeSyntaxMaxVersion())
	assert.Equal(t, "my_stackname", manager.NormalizeStackName("My_Stack Name!"))
	assert.Equal(t, "abc", manager.NormalizeStackName("ABC@@@"))
}

func Test_createEnvFile_nestedEntryPointDefaultEnv(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	subdir := filepath.Join(dir, "compose")
	require.NoError(t, os.MkdirAll(subdir, 0o700))
	require.NoError(t, os.WriteFile(filepath.Join(subdir, ".env"), []byte("NESTED=1\n"), 0o600))

	stack := &portainer.Stack{
		ProjectPath: dir,
		EntryPoint:  "compose/docker-compose.yml",
		Env:         []portainer.Pair{{Name: "INLINE", Value: "2"}},
	}
	path, err := createEnvFile(stack)
	require.NoError(t, err)
	require.NotEmpty(t, path)

	content, err := os.ReadFile(path)
	require.NoError(t, err)
	assert.Equal(t, "NESTED=1\n\nINLINE=2\n", string(content))
}

func Test_createEnvFile_openFailure(t *testing.T) {
	t.Parallel()

	stack := &portainer.Stack{
		ProjectPath: filepath.Join(t.TempDir(), "nope"),
		Env:         []portainer.Pair{{Name: "X", Value: "1"}},
	}
	path, err := createEnvFile(stack)
	require.Error(t, err)
	assert.Empty(t, path)
}


func TestREQ_STK_02_ComposeStackManager_RunEnvFileError(t *testing.T) {
	t.Parallel()

	manager := NewComposeStackManager(&recordingComposeDeployer{}, nil)
	stack := &portainer.Stack{
		Name:        "bad-env-run",
		ProjectPath: filepath.Join(t.TempDir(), "missing", "path"),
		EntryPoint:  "compose.yml",
		Env:         []portainer.Pair{{Name: "A", Value: "1"}},
	}
	err := manager.Run(t.Context(), stack, localUnixEndpoint(), "web", portainer.ComposeRunOptions{})
	require.ErrorContains(t, err, "failed to create env file")
}

func TestREQ_STK_02_ComposeStackManager_PullEnvFileError(t *testing.T) {
	t.Parallel()

	manager := NewComposeStackManager(&recordingComposeDeployer{}, nil)
	stack := &portainer.Stack{
		Name:        "bad-env-pull",
		ProjectPath: filepath.Join(t.TempDir(), "missing", "path"),
		EntryPoint:  "compose.yml",
		Env:         []portainer.Pair{{Name: "A", Value: "1"}},
	}
	err := manager.Pull(t.Context(), stack, localUnixEndpoint(), portainer.ComposeOptions{})
	require.ErrorContains(t, err, "failed to create env file")
}

type errWriter struct{ err error }

func (w errWriter) Write([]byte) (int, error) { return 0, w.err }

func Test_copyConfigEnvVars_writeError(t *testing.T) {
	t.Parallel()

	err := copyConfigEnvVars(errWriter{err: errors.New("write boom")}, []portainer.Pair{{Name: "A", Value: "1"}})
	require.ErrorContains(t, err, "failed to copy config env vars")
	require.ErrorContains(t, err, "write boom")
}

func Test_copyDefaultEnvFile_appendNewlineError(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	envPath := filepath.Join(dir, ".env")
	require.NoError(t, os.WriteFile(envPath, []byte("A=1"), 0o600))

	err := copyDefaultEnvFile(errWriter{err: errors.New("nl boom")}, envPath)
	// io.Copy fails first on the failing writer, and that error is intentionally ignored.
	require.NoError(t, err)
}
