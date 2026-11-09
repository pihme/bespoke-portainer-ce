package stackbuilders

import (
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

func newComposeFileBuilderFixture(t *testing.T) (*ComposeStackFileBuilder, *datastore.Store, *testhelpers.TestStackDeployer, *portainer.User) {
	t.Helper()

	_, store := datastore.MustNewTestStore(t, false, true)
	admin := &portainer.User{Username: "admin", Role: portainer.AdministratorRole}
	require.NoError(t, store.User().Create(admin))

	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	deployer := testhelpers.NewTestStackDeployer()
	sec := &security.RestrictedRequestContext{UserID: admin.ID, IsAdmin: true}

	builder := CreateComposeStackFileBuilder(sec, store, fileService, deployer)
	require.NotNil(t, builder)

	return builder, store, deployer, admin
}

func TestREQ_STK_02_CreateComposeStackFileBuilder(t *testing.T) {
	t.Parallel()

	builder, store, deployer, admin := newComposeFileBuilderFixture(t)

	assert.Same(t, store, builder.dataStore)
	assert.Same(t, deployer, builder.stackDeployer)
	require.NotNil(t, builder.SecurityContext)
	assert.Equal(t, admin.ID, builder.SecurityContext.UserID)
	assert.True(t, builder.SecurityContext.IsAdmin)
	assert.True(t, builder.doCleanUp)
	require.NotNil(t, builder.stack)
}

func TestREQ_STK_02_ComposeStackFileBuilder_prepare_StoresFileAndMetadata(t *testing.T) {
	t.Parallel()

	builder, _, _, admin := newComposeFileBuilderFixture(t)
	builder.setGeneralInfo(&portainer.Endpoint{ID: 3})

	content := []byte("services:\n  web:\n    image: nginx:alpine\n")
	payload := &StackPayload{
		Name:             "from-file",
		StackFileContent: content,
		Env:              []portainer.Pair{{Name: "FOO", Value: "bar"}},
		FromAppTemplate:  true,
	}

	require.NoError(t, builder.prepare(t.Context(), payload, admin.ID))

	assert.Equal(t, "from-file", builder.stack.Name)
	assert.Equal(t, portainer.DockerComposeStack, builder.stack.Type)
	assert.Equal(t, filesystem.ComposeFileDefaultName, builder.stack.EntryPoint)
	assert.Equal(t, payload.Env, builder.stack.Env)
	assert.True(t, builder.stack.FromAppTemplate)
	assert.Equal(t, "admin", builder.stack.CreatedBy)
	require.NotEmpty(t, builder.stack.ProjectPath)

	stored, err := os.ReadFile(filepath.Join(builder.stack.ProjectPath, filesystem.ComposeFileDefaultName))
	require.NoError(t, err)
	assert.Equal(t, content, stored)
}

func TestREQ_STK_02_ComposeStackFileBuilder_prepare_MissingUser(t *testing.T) {
	t.Parallel()

	builder, _, _, _ := newComposeFileBuilderFixture(t)
	builder.setGeneralInfo(&portainer.Endpoint{ID: 1})

	err := builder.prepare(t.Context(), &StackPayload{Name: "x", StackFileContent: []byte("services: {}\n")}, 999)
	require.ErrorContains(t, err, "failed to find stack author")
}

func TestREQ_STK_02_ComposeStackFileBuilder_deploy_UsesLocalComposeDeployer(t *testing.T) {
	t.Parallel()

	builder, store, deployer, admin := newComposeFileBuilderFixture(t)
	endpoint := &portainer.Endpoint{ID: 1}
	builder.setGeneralInfo(endpoint)

	content := []byte("services:\n  web:\n    image: alpine:3.19\n")
	require.NoError(t, builder.prepare(t.Context(), &StackPayload{
		Name:             "deploy-me",
		StackFileContent: content,
	}, admin.ID))

	require.NoError(t, builder.deploy(t.Context(), endpoint))
	assert.Equal(t, 1, deployer.DeployComposeCallCount)

	stack, err := builder.saveStack()
	require.NoError(t, err)
	read, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, "deploy-me", read.Name)
	assert.Equal(t, portainer.DockerComposeStack, read.Type)
}

func TestREQ_STK_02_ComposeStackFileBuilder_BuildAndAsyncDeploy(t *testing.T) {
	t.Parallel()

	builder, store, deployer, admin := newComposeFileBuilderFixture(t)
	endpoint := &portainer.Endpoint{ID: 2}

	stack, herr := BuildAndAsyncDeploy(t.Context(), store, builder, &StackPayload{
		Name:             "async-compose",
		StackFileContent: []byte("services:\n  web:\n    image: alpine:3.19\n"),
		Env:              []portainer.Pair{{Name: "A", Value: "1"}},
	}, endpoint, admin.ID)
	require.Nil(t, herr)
	require.NotNil(t, stack)
	assert.Equal(t, "async-compose", stack.Name)
	assert.Equal(t, portainer.DockerComposeStack, stack.Type)
	assert.Equal(t, portainer.StackStatusDeploying, stack.Status)

	waitForStackStatus(t, store, stack.ID, portainer.StackStatusActive)
	assert.GreaterOrEqual(t, deployer.DeployComposeCallCount, 1)
}

func TestREQ_STK_02_ComposeStackFileBuilder_deploy_MissingUser(t *testing.T) {
	t.Parallel()

	builder, _, _, admin := newComposeFileBuilderFixture(t)
	builder.SecurityContext = &security.RestrictedRequestContext{UserID: 999}
	endpoint := &portainer.Endpoint{ID: 1}
	builder.setGeneralInfo(endpoint)
	require.NoError(t, builder.prepare(t.Context(), &StackPayload{
		Name:             "bad-deploy",
		StackFileContent: []byte("services:\n  web:\n    image: alpine:3.19\n"),
	}, admin.ID))

	err := builder.deploy(t.Context(), endpoint)
	require.ErrorContains(t, err, "failed to create compose deployment config")
}
