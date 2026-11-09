package stacks

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/stacks/stackutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubDeployConfiger struct {
	stubStackDeploymentConfiger
	undeployErr   error
	undeployCalls atomic.Int32
	deployCalls   atomic.Int32
}

func (s *stubDeployConfiger) Deploy(ctx context.Context) error {
	s.deployCalls.Add(1)
	return s.deployErr
}

func (s *stubDeployConfiger) Undeploy(ctx context.Context) error {
	s.undeployCalls.Add(1)
	return s.undeployErr
}

func TestREQ_STK_04_StackDeploy_Success_SetsActiveAndCallsPostDeploy(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack := &portainer.Stack{ID: 1, Name: "async", Type: portainer.DockerComposeStack, Status: portainer.StackStatusActive}
	stackutils.PrepareStackStatusForDeployment(stack)
	require.NoError(t, store.Stack().Create(stack))

	cfg := &stubDeployConfiger{}
	var postErr error
	var called atomic.Bool
	post := func(_ context.Context, err error) {
		called.Store(true)
		postErr = err
	}

	stackDeploy(store, stack.ID, cfg, post)

	require.True(t, called.Load())
	require.NoError(t, postErr)
	assert.Equal(t, int32(1), cfg.deployCalls.Load())
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, portainer.StackStatusActive, updated.Status)
}

func TestREQ_STK_04_StackDeploy_DeployFailure_SetsErrorStatus(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack := &portainer.Stack{ID: 1, Name: "async-fail", Type: portainer.DockerComposeStack, Status: portainer.StackStatusActive}
	stackutils.PrepareStackStatusForDeployment(stack)
	require.NoError(t, store.Stack().Create(stack))

	deployErr := errors.New("compose up failed")
	cfg := &stubDeployConfiger{stubStackDeploymentConfiger: stubStackDeploymentConfiger{deployErr: deployErr}}
	var postErr error
	post := func(_ context.Context, err error) { postErr = err }

	stackDeploy(store, stack.ID, cfg, post)

	require.Equal(t, deployErr, postErr)
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, portainer.StackStatusError, updated.Status)
}

func TestREQ_STK_04_StackDeploy_ShouldUndeploy_CallsUndeployBeforeDeploy(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack := &portainer.Stack{
		ID: 1, Name: "undeploy-first", Type: portainer.DockerComposeStack,
		Status:               portainer.StackStatusDeploying,
		DeploymentStartStatus: portainer.StackStatusError,
		DeploymentStatus: []portainer.StackDeploymentStatus{
			{Status: portainer.StackStatusDeploying},
		},
	}
	require.NoError(t, store.Stack().Create(stack))

	cfg := &stubDeployConfiger{}
	stackDeploy(store, stack.ID, cfg, nil)

	assert.Equal(t, int32(1), cfg.undeployCalls.Load())
	assert.Equal(t, int32(1), cfg.deployCalls.Load())
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, portainer.StackStatusActive, updated.Status)
}

func TestREQ_STK_04_StackDeploy_UndeployFailure_PersistsUndeployStatus(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack := &portainer.Stack{
		ID: 1, Name: "undeploy-fail", Type: portainer.DockerComposeStack,
		Status:                portainer.StackStatusDeploying,
		DeploymentStartStatus: portainer.StackStatusError,
		DeploymentStatus:      []portainer.StackDeploymentStatus{{Status: portainer.StackStatusDeploying}},
	}
	require.NoError(t, store.Stack().Create(stack))

	undeployErr := errors.New("undeploy failed")
	cfg := &stubDeployConfiger{undeployErr: undeployErr}
	stackDeploy(store, stack.ID, cfg, nil)

	assert.Equal(t, int32(1), cfg.undeployCalls.Load())
	// deploy still proceeds after undeploy attempt
	assert.Equal(t, int32(1), cfg.deployCalls.Load())
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	// After failed undeploy status update then successful deploy → Active
	assert.Equal(t, portainer.StackStatusActive, updated.Status)
}

func TestREQ_STK_04_StackDeploy_MissingStack_ReturnsEarly(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	cfg := &stubDeployConfiger{}
	// should not panic; ViewTx fails to find stack
	stackDeploy(store, 99, cfg, nil)
	assert.Equal(t, int32(0), cfg.deployCalls.Load())
}

func TestREQ_STK_04_StackDeploy_NilPostDeploy_OK(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack := &portainer.Stack{ID: 1, Name: "nopost", Type: portainer.DockerComposeStack, Status: portainer.StackStatusActive}
	stackutils.PrepareStackStatusForDeployment(stack)
	require.NoError(t, store.Stack().Create(stack))
	stackDeploy(store, stack.ID, &stubDeployConfiger{}, nil)
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, portainer.StackStatusActive, updated.Status)
}

