package stackbuilders

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	gittypes "github.com/portainer/portainer/api/git/types"
	"github.com/portainer/portainer/api/gitops/scheduling"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/api/scheduler"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newComposeGitBuilderFixture(t *testing.T, commitHash string) (*ComposeStackGitBuilder, *datastore.Store, *testhelpers.TestStackDeployer, *portainer.User) {
	t.Helper()

	_, store := datastore.MustNewTestStore(t, false, true)
	admin := &portainer.User{Username: "admin", Role: portainer.AdministratorRole}
	require.NoError(t, store.User().Create(admin))

	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	deployer := testhelpers.NewTestStackDeployer()
	gitService := testhelpers.NewGitService(nil, commitHash)
	sourceScheduler := scheduling.NewSourceScheduler(scheduler.NewScheduler(t.Context()), store, scheduling.Deployers{})
	sec := &security.RestrictedRequestContext{UserID: admin.ID, IsAdmin: true}

	builder := CreateComposeStackGitBuilder(sec, store, fileService, gitService, sourceScheduler, deployer)
	require.NotNil(t, builder)

	return builder, store, deployer, admin
}

func TestREQ_STK_03_CreateComposeStackGitBuilder(t *testing.T) {
	t.Parallel()

	builder, store, deployer, admin := newComposeGitBuilderFixture(t, "abc123")

	assert.Same(t, store, builder.dataStore)
	assert.Same(t, deployer, builder.stackDeployer)
	require.NotNil(t, builder.gitService)
	require.NotNil(t, builder.sourceScheduler)
	require.NotNil(t, builder.SecurityContext)
	assert.Equal(t, admin.ID, builder.SecurityContext.UserID)
	assert.True(t, builder.doCleanUp)
}

func TestREQ_STK_03_ComposeStackGitBuilder_prepare_SetsComposeMetadataAndClones(t *testing.T) {
	t.Parallel()

	builder, store, _, admin := newComposeGitBuilderFixture(t, "deadbeef")
	builder.setGeneralInfo(&portainer.Endpoint{ID: 4})

	payload := &StackPayload{
		Name:            "git-compose",
		ComposeFile:     "compose/app.yml",
		FromAppTemplate: true,
		Env:             []portainer.Pair{{Name: "ENV", Value: "prod"}},
		RepositoryConfigPayload: RepositoryConfigPayload{
			URL:           "https://github.com/org/compose-repo",
			ReferenceName: "refs/heads/main",
			Authentication: true,
			Username:      "git-user",
			Password:      "git-token",
			TLSSkipVerify: true,
		},
	}

	require.NoError(t, builder.prepare(t.Context(), payload, admin.ID))

	assert.Equal(t, "git-compose", builder.stack.Name)
	assert.Equal(t, portainer.DockerComposeStack, builder.stack.Type)
	assert.Equal(t, "compose/app.yml", builder.stack.EntryPoint)
	assert.True(t, builder.stack.FromAppTemplate)
	assert.Equal(t, payload.Env, builder.stack.Env)
	assert.Equal(t, "admin", builder.stack.CreatedBy)
	assert.NotZero(t, builder.stack.WorkflowID)
	assert.NotZero(t, builder.resolvedSourceID)
	require.NotEmpty(t, builder.stack.ProjectPath)

	sources, err := store.Source().ReadAll(adminUserContext)
	require.NoError(t, err)
	require.Len(t, sources, 1)
	assert.Equal(t, "https://github.com/org/compose-repo", sources[0].Git.URL)
	require.NotNil(t, sources[0].Git.Authentication)
	assert.Equal(t, "git-user", sources[0].Git.Authentication.Username)
	assert.True(t, sources[0].Git.TLSSkipVerify)
}

func TestREQ_STK_03_ComposeStackGitBuilder_prepare_DefaultComposeFile(t *testing.T) {
	t.Parallel()

	builder, _, _, admin := newComposeGitBuilderFixture(t, "hash1")
	builder.setGeneralInfo(&portainer.Endpoint{ID: 1})

	require.NoError(t, builder.prepare(t.Context(), &StackPayload{
		Name: "default-compose",
		RepositoryConfigPayload: RepositoryConfigPayload{
			URL: "https://github.com/org/public",
		},
	}, admin.ID))

	assert.Equal(t, "", builder.stack.EntryPoint)
	assert.Equal(t, portainer.DockerComposeStack, builder.stack.Type)
	assert.NotZero(t, builder.stack.WorkflowID)
}

func TestREQ_STK_03_ComposeStackGitBuilder_deploy_UsesLocalComposeDeployer(t *testing.T) {
	t.Parallel()

	builder, _, deployer, admin := newComposeGitBuilderFixture(t, "cafebabe")
	endpoint := &portainer.Endpoint{ID: 1}
	builder.setGeneralInfo(endpoint)

	require.NoError(t, builder.prepare(t.Context(), &StackPayload{
		Name:        "git-deploy",
		ComposeFile: filesystem.ComposeFileDefaultName,
		RepositoryConfigPayload: RepositoryConfigPayload{
			URL: "https://github.com/org/app",
		},
	}, admin.ID))

	require.NoError(t, builder.deploy(t.Context(), endpoint))
	assert.Equal(t, 1, deployer.DeployComposeCallCount)
}

func TestREQ_STK_03_ComposeStackGitBuilder_BuildAndDeploy_RunsPostDeploy(t *testing.T) {
	t.Parallel()

	builder, store, deployer, admin := newComposeGitBuilderFixture(t, "posthash")
	endpoint := &portainer.Endpoint{ID: 5}

	stack, herr := BuildAndDeploy(t.Context(), store, builder, &StackPayload{
		Name:        "sync-git-compose",
		ComposeFile: filesystem.ComposeFileDefaultName,
		RepositoryConfigPayload: RepositoryConfigPayload{
			URL:           "https://github.com/org/sync-repo",
			ReferenceName: "refs/heads/main",
		},
	}, endpoint, admin.ID)
	require.Nil(t, herr)
	require.NotNil(t, stack)
	assert.Equal(t, "sync-git-compose", stack.Name)
	assert.Equal(t, portainer.DockerComposeStack, stack.Type)
	assert.Equal(t, portainer.StackStatusActive, stack.Status)
	assert.Equal(t, 1, deployer.DeployComposeCallCount)
	assert.NotZero(t, builder.resolvedSourceID)
}

func TestREQ_STK_03_ComposeStackGitBuilder_prepare_ExistingSource(t *testing.T) {
	t.Parallel()

	builder, store, _, admin := newComposeGitBuilderFixture(t, "src-hash")
	builder.setGeneralInfo(&portainer.Endpoint{ID: 1})

	src := &portainer.Source{
		Name: "existing",
		Type: portainer.SourceTypeGit,
		Git: &gittypes.GitSource{
			URL: "https://github.com/org/existing",
			Authentication: &gittypes.GitAuthentication{
				Username: "u",
				Password: "p",
			},
		},
	}
	require.NoError(t, store.Source().Create(adminUserContext, src))

	require.NoError(t, builder.prepare(t.Context(), &StackPayload{
		Name:        "from-source",
		ComposeFile: "docker-compose.yml",
		RepositoryConfigPayload: RepositoryConfigPayload{
			SourceID:      src.ID,
			ReferenceName: "refs/heads/dev",
		},
	}, admin.ID))

	assert.Equal(t, src.ID, builder.resolvedSourceID)
	assert.Equal(t, portainer.DockerComposeStack, builder.stack.Type)

	all, err := store.Source().ReadAll(adminUserContext)
	require.NoError(t, err)
	assert.Len(t, all, 1)
}

func TestREQ_STK_03_ComposeStackGitBuilder_deploy_MissingUser(t *testing.T) {
	t.Parallel()

	builder, _, _, admin := newComposeGitBuilderFixture(t, "errhash")
	builder.SecurityContext = &security.RestrictedRequestContext{UserID: 999}
	endpoint := &portainer.Endpoint{ID: 1}
	builder.setGeneralInfo(endpoint)
	require.NoError(t, builder.prepare(t.Context(), &StackPayload{
		Name: "bad-git-deploy",
		RepositoryConfigPayload: RepositoryConfigPayload{URL: "https://github.com/org/x"},
	}, admin.ID))

	err := builder.deploy(t.Context(), endpoint)
	require.ErrorContains(t, err, "failed to create compose deployment config")
}
