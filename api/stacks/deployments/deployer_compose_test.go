package deployments

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	dockerclient "github.com/portainer/portainer/api/docker/client"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type recordingComposeManager struct {
	pullCalls atomic.Int32
	upCalls   atomic.Int32
	downCalls atomic.Int32
	lastUp    portainer.ComposeUpOptions
	pullErr   error
	upErr     error
	downErr   error
}

func (m *recordingComposeManager) ComposeSyntaxMaxVersion() string { return "" }
func (m *recordingComposeManager) NormalizeStackName(name string) string {
	return name
}
func (m *recordingComposeManager) Run(context.Context, *portainer.Stack, *portainer.Endpoint, string, portainer.ComposeRunOptions) error {
	return nil
}
func (m *recordingComposeManager) Up(_ context.Context, _ *portainer.Stack, _ *portainer.Endpoint, options portainer.ComposeUpOptions) error {
	m.upCalls.Add(1)
	m.lastUp = options
	return m.upErr
}
func (m *recordingComposeManager) Down(context.Context, *portainer.Stack, *portainer.Endpoint) error {
	m.downCalls.Add(1)
	return m.downErr
}
func (m *recordingComposeManager) Pull(context.Context, *portainer.Stack, *portainer.Endpoint, portainer.ComposeOptions) error {
	m.pullCalls.Add(1)
	return m.pullErr
}

func TestREQ_STK_02_DeployComposeStack(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	manager := &recordingComposeManager{}
	factory := dockerclient.NewClientFactory(nil, nil)
	deployer := NewStackDeployer(nil, manager, nil, factory, store)

	stack := &portainer.Stack{Name: "web", Type: portainer.DockerComposeStack}
	endpoint := &portainer.Endpoint{ID: 1}
	registries := []portainer.Registry{{Name: "r1"}}

	require.NoError(t, deployer.DeployComposeStack(t.Context(), stack, endpoint, registries, true, false, true))
	assert.Equal(t, int32(0), manager.pullCalls.Load(), "pull must be skipped when forcePullImage is false")
	assert.Equal(t, int32(1), manager.upCalls.Load())
	assert.True(t, manager.lastUp.ForceRecreate)
	assert.True(t, manager.lastUp.Prune)
	assert.Equal(t, registries, manager.lastUp.Registries)

	require.NoError(t, deployer.DeployComposeStack(t.Context(), stack, endpoint, registries, false, true, false))
	assert.Equal(t, int32(1), manager.pullCalls.Load())
	assert.Equal(t, int32(2), manager.upCalls.Load())
	assert.False(t, manager.lastUp.ForceRecreate)
	assert.False(t, manager.lastUp.Prune)

	manager.pullErr = errors.New("pull failed")
	err := deployer.DeployComposeStack(t.Context(), stack, endpoint, registries, false, true, false)
	require.ErrorContains(t, err, "pull failed")
	assert.Equal(t, int32(2), manager.pullCalls.Load())
	assert.Equal(t, int32(2), manager.upCalls.Load(), "Up must not run after Pull fails")

	assert.Same(t, factory, deployer.GetDockerClientFactory())
}

func TestREQ_STK_08_UndeployComposeStack(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	manager := &recordingComposeManager{}
	deployer := NewStackDeployer(nil, manager, nil, nil, store)

	require.NoError(t, deployer.UndeployComposeStack(t.Context(), &portainer.Stack{Name: "web"}, &portainer.Endpoint{ID: 1}))
	assert.Equal(t, int32(1), manager.downCalls.Load())

	manager.downErr = errors.New("down failed")
	err := deployer.UndeployComposeStack(t.Context(), &portainer.Stack{Name: "web"}, &portainer.Endpoint{ID: 1})
	require.ErrorContains(t, err, "down failed")
}
