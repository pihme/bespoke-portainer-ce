package stackbuilders

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestStackBuilder(t *testing.T) (*StackBuilder, *datastore.Store, portainer.FileService, *testhelpers.TestStackDeployer) {
	t.Helper()

	_, store := datastore.MustNewTestStore(t, false, true)
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	deployer := testhelpers.NewTestStackDeployer()
	builder := CreateStackBuilder(store, fileService, deployer)

	return &builder, store, fileService, deployer
}

type recordingDeploymentConfiger struct {
	deployCalls   int
	undeployCalls int
	deployErr     error
	response      string
}

func (c *recordingDeploymentConfiger) Deploy(_ context.Context) error {
	c.deployCalls++
	return c.deployErr
}

func (c *recordingDeploymentConfiger) Undeploy(_ context.Context) error {
	c.undeployCalls++
	return nil
}

func (c *recordingDeploymentConfiger) GetResponse() string {
	return c.response
}

func TestCreateStackBuilder_InitializesDefaults(t *testing.T) {
	t.Parallel()

	builder, store, fileService, deployer := newTestStackBuilder(t)

	require.NotNil(t, builder.stack)
	assert.Same(t, store, builder.dataStore)
	assert.Same(t, fileService, builder.fileService)
	assert.Same(t, deployer, builder.stackDeployer)
	assert.True(t, builder.doCleanUp)
}

func TestStackBuilder_setGeneralInfo_AssignsEndpointAndDeployingStatus(t *testing.T) {
	t.Parallel()

	builder, _, _, _ := newTestStackBuilder(t)
	endpoint := &portainer.Endpoint{ID: 7}

	builder.setGeneralInfo(endpoint)

	assert.Same(t, endpoint, builder.endpoint)
	assert.Equal(t, portainer.EndpointID(7), builder.stack.EndpointID)
	assert.NotZero(t, builder.stack.ID)
	assert.NotZero(t, builder.stack.CreationDate)
	assert.Equal(t, portainer.StackStatusDeploying, builder.stack.Status)
	require.Len(t, builder.stack.DeploymentStatus, 1)
	assert.Equal(t, portainer.StackStatusDeploying, builder.stack.DeploymentStatus[0].Status)
}

func TestStackBuilder_initCreatedBy_SetsUsername(t *testing.T) {
	t.Parallel()

	builder, store, _, _ := newTestStackBuilder(t)
	require.NoError(t, store.User().Create(&portainer.User{Username: "alice", Role: portainer.AdministratorRole}))

	users, err := store.User().ReadAll()
	require.NoError(t, err)
	require.NotEmpty(t, users)

	require.NoError(t, builder.initCreatedBy(users[0].ID))
	assert.Equal(t, "alice", builder.stack.CreatedBy)
}

func TestStackBuilder_initCreatedBy_MissingUser_ReturnsError(t *testing.T) {
	t.Parallel()

	builder, _, _, _ := newTestStackBuilder(t)

	err := builder.initCreatedBy(portainer.UserID(999))
	require.ErrorContains(t, err, "failed to find stack author")
}

func TestStackBuilder_storeStackFile_PersistsContentAndProjectPath(t *testing.T) {
	t.Parallel()

	builder, _, _, _ := newTestStackBuilder(t)
	builder.stack.ID = 42
	builder.stack.EntryPoint = filesystem.ComposeFileDefaultName
	content := []byte("services:\n  web:\n    image: alpine:3.19\n")

	require.NoError(t, builder.storeStackFile(content))
	require.NotEmpty(t, builder.stack.ProjectPath)

	stored, err := os.ReadFile(filepath.Join(builder.stack.ProjectPath, filesystem.ComposeFileDefaultName))
	require.NoError(t, err)
	assert.Equal(t, content, stored)
}

func TestStackBuilder_saveStack_PersistsAndDisablesCleanup(t *testing.T) {
	t.Parallel()

	builder, store, _, _ := newTestStackBuilder(t)
	builder.setGeneralInfo(&portainer.Endpoint{ID: 1})
	builder.stack.Name = "saved-stack"
	builder.stack.Type = portainer.DockerComposeStack

	stack, err := builder.saveStack()
	require.NoError(t, err)
	require.NotNil(t, stack)
	assert.False(t, builder.doCleanUp)

	read, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, "saved-stack", read.Name)
	assert.Equal(t, portainer.DockerComposeStack, read.Type)
}

func TestStackBuilder_cleanUp_SkipsWhenDisabled(t *testing.T) {
	t.Parallel()

	builder, _, _, _ := newTestStackBuilder(t)
	builder.doCleanUp = false
	builder.stack.ProjectPath = t.TempDir()

	require.NoError(t, builder.cleanUp())
	_, err := os.Stat(builder.stack.ProjectPath)
	require.NoError(t, err, "project path must remain when cleanup is disabled")
}

func TestStackBuilder_cleanUp_RemovesProjectPathAndOrphanWorkflow(t *testing.T) {
	t.Parallel()

	builder, store, _, _ := newTestStackBuilder(t)
	projectPath := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(projectPath, "marker"), []byte("x"), 0o600))

	wf := &portainer.Workflow{Name: "orphan"}
	require.NoError(t, store.Workflow().Create(wf))

	builder.doCleanUp = true
	builder.stack.ProjectPath = projectPath
	builder.stack.WorkflowID = wf.ID

	require.NoError(t, builder.cleanUp())

	_, err := os.Stat(projectPath)
	assert.True(t, os.IsNotExist(err), "project directory must be removed")

	_, err = store.Workflow().Read(wf.ID)
	assert.True(t, store.IsErrObjectNotFound(err), "orphan workflow must be deleted")
}

func TestStackBuilder_cleanUp_MissingWorkflow_StillRemovesDirectory(t *testing.T) {
	t.Parallel()

	builder, _, _, _ := newTestStackBuilder(t)
	projectPath := t.TempDir()
	builder.doCleanUp = true
	builder.stack.ProjectPath = projectPath
	builder.stack.WorkflowID = 999

	require.NoError(t, builder.cleanUp())
	_, err := os.Stat(projectPath)
	assert.True(t, os.IsNotExist(err))
}

func TestStackBuilder_postDeploy_IsNoOp(t *testing.T) {
	t.Parallel()

	builder, _, _, _ := newTestStackBuilder(t)
	require.NoError(t, builder.postDeploy(t.Context(), &portainer.Stack{ID: 1}))
}

func TestStackBuilder_deploy_DelegatesToDeploymentConfiger(t *testing.T) {
	t.Parallel()

	builder, _, _, _ := newTestStackBuilder(t)
	cfg := &recordingDeploymentConfiger{}
	builder.deploymentConfiger = cfg

	require.NoError(t, builder.deploy(t.Context(), &portainer.Endpoint{ID: 1}))
	assert.Equal(t, 1, cfg.deployCalls)

	cfg.deployErr = errors.New("deploy failed")
	err := builder.deploy(t.Context(), &portainer.Endpoint{ID: 1})
	require.ErrorContains(t, err, "deploy failed")
}

func TestREQ_STK_02_StackBuilder_initComposeDeployment(t *testing.T) {
	t.Parallel()

	builder, store, _, deployer := newTestStackBuilder(t)
	admin := &portainer.User{Username: "admin", Role: portainer.AdministratorRole}
	require.NoError(t, store.User().Create(admin))

	builder.stack.Name = "web"
	builder.stack.Type = portainer.DockerComposeStack
	builder.stack.ProjectPath = t.TempDir()
	builder.stack.EntryPoint = filesystem.ComposeFileDefaultName
	require.NoError(t, os.WriteFile(filepath.Join(builder.stack.ProjectPath, filesystem.ComposeFileDefaultName), []byte("services:\n  web:\n    image: alpine:3.19\n"), 0o600))

	endpoint := &portainer.Endpoint{ID: 1}
	sec := &security.RestrictedRequestContext{UserID: admin.ID, IsAdmin: true}

	require.NoError(t, builder.initComposeDeployment(sec, endpoint))
	require.NotNil(t, builder.deploymentConfiger)
	require.NoError(t, builder.deploymentConfiger.Deploy(t.Context()))
	assert.Equal(t, 1, deployer.DeployComposeCallCount)
}

func TestREQ_STK_02_StackBuilder_initComposeDeployment_MissingUser(t *testing.T) {
	t.Parallel()

	builder, _, _, _ := newTestStackBuilder(t)
	err := builder.initComposeDeployment(&security.RestrictedRequestContext{UserID: 99}, &portainer.Endpoint{ID: 1})
	require.ErrorContains(t, err, "failed to create compose deployment config")
}

type failingStoreFileService struct {
	portainer.FileService
	storeErr error
}

func (s *failingStoreFileService) StoreStackFileFromBytes(stackIdentifier, fileName string, data []byte) (string, error) {
	return "", s.storeErr
}

func (s *failingStoreFileService) RemoveDirectory(directoryPath string) error {
	return errors.New("remove failed")
}

func TestStackBuilder_storeStackFile_PropagatesFileServiceError(t *testing.T) {
	t.Parallel()

	builder, _, _, _ := newTestStackBuilder(t)
	builder.fileService = &failingStoreFileService{storeErr: errors.New("disk full")}
	builder.stack.ID = 1
	builder.stack.EntryPoint = filesystem.ComposeFileDefaultName

	err := builder.storeStackFile([]byte("services: {}\n"))
	require.ErrorContains(t, err, "disk full")
}

func TestStackBuilder_cleanUp_RemoveDirectoryError_StillReturnsNil(t *testing.T) {
	t.Parallel()

	builder, _, _, _ := newTestStackBuilder(t)
	builder.fileService = &failingStoreFileService{}
	builder.doCleanUp = true
	builder.stack.ProjectPath = "/tmp/does-not-matter"
	builder.stack.WorkflowID = 0

	require.NoError(t, builder.cleanUp())
}
