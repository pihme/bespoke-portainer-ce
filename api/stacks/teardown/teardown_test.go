package teardown_test

import (
	"context"
	"errors"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/stacks/deployments"
	"github.com/portainer/portainer/api/stacks/teardown"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDeleteRecords_RemovesStackAndResourceControl(t *testing.T) {
	t.Parallel()
	svc, store := newService(t, &stubFileService{}, &stubComposeStackManager{}, &stubStackDeployer{})

	stack := &portainer.Stack{ID: 1, EndpointID: 1, Type: portainer.DockerComposeStack, Name: "test-stack", ProjectPath: "/data/compose/1"}
	require.NoError(t, store.Stack().Create(stack))

	resourceControl := &portainer.ResourceControl{ResourceID: "1_test-stack", Type: portainer.StackResourceControl}
	require.NoError(t, store.ResourceControl().Create(resourceControl))

	require.NoError(t, deleteRecords(t, store, svc, stack))

	_, err := store.Stack().Read(stack.ID)
	assert.True(t, store.IsErrObjectNotFound(err))

	_, err = store.ResourceControl().Read(resourceControl.ID)
	assert.True(t, store.IsErrObjectNotFound(err))
}

// The record deletions must be atomic with the caller's other writes: if the
// surrounding transaction fails after DeleteRecords, the stack record must
// survive. This is the guarantee that lets handlers delete the stack and its
// associated workflow in a single transaction.
func TestDeleteRecords_RollsBackWithSurroundingTransaction(t *testing.T) {
	t.Parallel()
	svc, store := newService(t, &stubFileService{}, &stubComposeStackManager{}, &stubStackDeployer{})

	stack := &portainer.Stack{ID: 1, EndpointID: 1, Type: portainer.DockerComposeStack, Name: "test-stack"}
	require.NoError(t, store.Stack().Create(stack))

	boom := errors.New("later write failed")
	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		if err := svc.DeleteRecords(tx, stack); err != nil {
			return err
		}

		return boom
	})
	require.ErrorIs(t, err, boom)

	_, err = store.Stack().Read(stack.ID)
	require.NoError(t, err)
}

func TestDeleteRecords_StackDeletionFails_ReturnsError(t *testing.T) {
	t.Parallel()
	svc, store := newService(t, &stubFileService{}, &stubComposeStackManager{}, &stubStackDeployer{})

	stack := &portainer.Stack{ID: 1, EndpointID: 1, Type: portainer.DockerComposeStack, Name: "test-stack"}
	require.NoError(t, store.Stack().Create(stack))

	deleteErr := errors.New("bucket is closed")
	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return svc.DeleteRecords(&failingStackDeleteTx{DataStoreTx: tx, deleteErr: deleteErr}, stack)
	})
	require.ErrorIs(t, err, deleteErr)

	_, err = store.Stack().Read(stack.ID)
	require.NoError(t, err, "stack should survive when its database deletion fails")
}

// failingStackDeleteTx wraps a real transaction but makes Stack().Delete fail,
// exercising the error path that a real boltdb Delete (idempotent on missing
// keys) can't otherwise trigger.
type failingStackDeleteTx struct {
	dataservices.DataStoreTx
	deleteErr error
}

func (tx *failingStackDeleteTx) Stack() dataservices.StackService {
	return &failingStackService{StackService: tx.DataStoreTx.Stack(), deleteErr: tx.deleteErr}
}

type failingStackService struct {
	dataservices.StackService
	deleteErr error
}

func (s *failingStackService) Delete(portainer.StackID) error {
	return s.deleteErr
}

func TestRemoveFiles_RemovesProjectDirectory(t *testing.T) {
	t.Parallel()
	fileService := &stubFileService{}
	svc, _ := newService(t, fileService, &stubComposeStackManager{}, &stubStackDeployer{})

	require.NoError(t, svc.RemoveFiles(&portainer.Stack{ProjectPath: "/data/compose/1"}))

	assert.Equal(t, "/data/compose/1", fileService.removedPath)
}

func TestRemoveFiles_ReturnsErrorWhenRemovalFails(t *testing.T) {
	t.Parallel()
	removeErr := errors.New("permission denied")
	fileService := &stubFileService{removeErr: removeErr}
	svc, _ := newService(t, fileService, &stubComposeStackManager{}, &stubStackDeployer{})

	err := svc.RemoveFiles(&portainer.Stack{ProjectPath: "/data/compose/1"})

	require.ErrorIs(t, err, removeErr)
}

// REQ-TAI-003: Docker Swarm is removed; tearing down a leftover Swarm stack
// record does not try to reach Docker and succeeds.
func TestREQ_TAI_003_RemoveResources_SwarmStackIsANoOp(t *testing.T) {
	t.Parallel()
	deployer := &stubStackDeployer{}
	svc, _ := newService(t, &stubFileService{}, &stubComposeStackManager{}, deployer)

	stack := &portainer.Stack{ID: 1, Type: portainer.DockerSwarmStack, Name: "test-stack"}

	require.NoError(t, svc.RemoveResources(context.Background(), 1, stack, &portainer.Endpoint{ID: 1}))
	assert.False(t, deployer.composeCalled)
}

// REQ-TAI-002: Kubernetes is removed; tearing down a leftover Kubernetes stack
// record does not try to reach a cluster and succeeds.
func TestREQ_TAI_002_RemoveResources_KubernetesStackIsANoOp(t *testing.T) {
	t.Parallel()
	svc, _ := newService(t, &stubFileService{}, &stubComposeStackManager{}, &stubStackDeployer{})

	stack := &portainer.Stack{ID: 1, Type: portainer.KubernetesStack, Name: "test-stack", ProjectPath: t.TempDir(), EntryPoint: "manifest.yml"}

	require.NoError(t, svc.RemoveResources(context.Background(), 1, stack, &portainer.Endpoint{ID: 1}))
}

func TestRemoveResources_ComposeStack(t *testing.T) {
	t.Parallel()
	deployer := &stubStackDeployer{}
	svc, _ := newService(t, &stubFileService{}, &stubComposeStackManager{}, deployer)

	stack := &portainer.Stack{ID: 1, Type: portainer.DockerComposeStack, Name: "test-stack"}

	require.NoError(t, svc.RemoveResources(context.Background(), 1, stack, &portainer.Endpoint{ID: 1}))
	assert.True(t, deployer.composeCalled)
}

func TestRemoveResources_UnsupportedStackType_ReturnsError(t *testing.T) {
	t.Parallel()
	svc, _ := newService(t, &stubFileService{}, &stubComposeStackManager{}, &stubStackDeployer{})

	stack := &portainer.Stack{ID: 1, Type: 99, Name: "test-stack"}

	require.Error(t, svc.RemoveResources(context.Background(), 1, stack, &portainer.Endpoint{ID: 1}))
}

func TestRemoveResources_DoesNotTouchDatabaseOrFilesystem(t *testing.T) {
	t.Parallel()
	fileService := &stubFileService{}
	svc, store := newService(t, fileService, &stubComposeStackManager{}, &stubStackDeployer{})

	// An external stack is never persisted to the database.
	stack := &portainer.Stack{Type: portainer.DockerComposeStack, Name: "external-stack"}

	require.NoError(t, svc.RemoveResources(context.Background(), 1, stack, &portainer.Endpoint{ID: 1}))
	assert.Empty(t, fileService.removedPath)

	_, err := store.Stack().Read(stack.ID)
	assert.True(t, store.IsErrObjectNotFound(err))
}

type stubComposeStackManager struct {
	portainer.ComposeStackManager
}

func (s *stubComposeStackManager) NormalizeStackName(name string) string { return name }

type stubStackDeployer struct {
	deployments.StackDeployer
	undeployErr   error
	composeCalled bool
}

func (s *stubStackDeployer) UndeployComposeStack(_ context.Context, _ *portainer.Stack, _ *portainer.Endpoint) error {
	s.composeCalled = true
	return s.undeployErr
}

type stubFileService struct {
	portainer.FileService
	removedPath string
	removeErr   error
}

func (s *stubFileService) RemoveDirectory(path string) error {
	s.removedPath = path
	return s.removeErr
}

func newService(t *testing.T, fileService portainer.FileService, composeStackManager portainer.ComposeStackManager, stackDeployer deployments.StackDeployer) (teardown.Service, *datastore.Store) {
	t.Helper()
	_, store := datastore.MustNewTestStore(t, true, false)

	return teardown.NewService(fileService, composeStackManager, stackDeployer), store
}

// deleteRecords runs the transactional record deletion the way handlers do:
// inside a write transaction.
func deleteRecords(t *testing.T, store *datastore.Store, svc teardown.Service, stack *portainer.Stack) error {
	t.Helper()
	return store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return svc.DeleteRecords(tx, stack)
	})
}

func TestDeleteRecords_ResourceControlLookupFails(t *testing.T) {
	t.Parallel()
	svc, store := newService(t, &stubFileService{}, &stubComposeStackManager{}, &stubStackDeployer{})

	stack := &portainer.Stack{ID: 1, EndpointID: 1, Type: portainer.DockerComposeStack, Name: "test-stack"}
	require.NoError(t, store.Stack().Create(stack))

	lookupErr := errors.New("rc lookup failed")
	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return svc.DeleteRecords(&failingRCLookupTx{DataStoreTx: tx, lookupErr: lookupErr}, stack)
	})
	require.ErrorIs(t, err, lookupErr)
}

func TestDeleteRecords_ResourceControlDeleteFails(t *testing.T) {
	t.Parallel()
	svc, store := newService(t, &stubFileService{}, &stubComposeStackManager{}, &stubStackDeployer{})

	stack := &portainer.Stack{ID: 1, EndpointID: 1, Type: portainer.DockerComposeStack, Name: "test-stack"}
	require.NoError(t, store.Stack().Create(stack))

	resourceControl := &portainer.ResourceControl{ResourceID: "1_test-stack", Type: portainer.StackResourceControl}
	require.NoError(t, store.ResourceControl().Create(resourceControl))

	deleteErr := errors.New("rc delete failed")
	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return svc.DeleteRecords(&failingRCDeleteTx{DataStoreTx: tx, deleteErr: deleteErr}, stack)
	})
	require.ErrorIs(t, err, deleteErr)
}

type failingRCLookupTx struct {
	dataservices.DataStoreTx
	lookupErr error
}

func (tx *failingRCLookupTx) ResourceControl() dataservices.ResourceControlService {
	return &failingRCLookupService{ResourceControlService: tx.DataStoreTx.ResourceControl(), lookupErr: tx.lookupErr}
}

type failingRCLookupService struct {
	dataservices.ResourceControlService
	lookupErr error
}

func (s *failingRCLookupService) ResourceControlByResourceIDAndType(string, portainer.ResourceControlType) (*portainer.ResourceControl, error) {
	return nil, s.lookupErr
}

type failingRCDeleteTx struct {
	dataservices.DataStoreTx
	deleteErr error
}

func (tx *failingRCDeleteTx) ResourceControl() dataservices.ResourceControlService {
	return &failingRCDeleteService{ResourceControlService: tx.DataStoreTx.ResourceControl(), deleteErr: tx.deleteErr}
}

type failingRCDeleteService struct {
	dataservices.ResourceControlService
	deleteErr error
}

func (s *failingRCDeleteService) ResourceControlByResourceIDAndType(resourceID string, resourceType portainer.ResourceControlType) (*portainer.ResourceControl, error) {
	return s.ResourceControlService.ResourceControlByResourceIDAndType(resourceID, resourceType)
}

func (s *failingRCDeleteService) Delete(portainer.ResourceControlID) error {
	return s.deleteErr
}
