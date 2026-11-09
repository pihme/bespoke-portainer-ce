package deployments

import (
	"context"
	"os"
	"sync/atomic"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/http/security"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type composeConfigRecordingDeployer struct {
	noopDeployer
	deployComposeCalls   atomic.Int32
	undeployComposeCalls atomic.Int32
	lastPrune            atomic.Bool
	lastForcePull        atomic.Bool
	lastForceCreate      atomic.Bool
	deployErr            error
	undeployErr          error
}

func (d *composeConfigRecordingDeployer) DeployComposeStack(_ context.Context, _ *portainer.Stack, _ *portainer.Endpoint, _ []portainer.Registry, prune, forcePullImage, forceRecreate bool) error {
	d.deployComposeCalls.Add(1)
	d.lastPrune.Store(prune)
	d.lastForcePull.Store(forcePullImage)
	d.lastForceCreate.Store(forceRecreate)
	return d.deployErr
}

func (d *composeConfigRecordingDeployer) UndeployComposeStack(_ context.Context, _ *portainer.Stack, _ *portainer.Endpoint) error {
	d.undeployComposeCalls.Add(1)
	return d.undeployErr
}

func writeMinimalCompose(t *testing.T, projectPath string) {
	t.Helper()
	err := os.WriteFile(filesystem.JoinPaths(projectPath, "docker-compose.yml"), []byte("services:\n  web:\n    image: alpine:3.19\n"), 0o600)
	require.NoError(t, err)
}

func TestREQ_STK_02_CreateComposeStackDeploymentConfigTx(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)

	admin := &portainer.User{Username: "admin", Role: portainer.AdministratorRole}
	require.NoError(t, store.User().Create(admin))

	require.NoError(t, store.Registry().Create(&portainer.Registry{
		Name: "r1",
		Type: portainer.CustomRegistry,
		URL:  "reg.example",
	}))

	endpoint := &portainer.Endpoint{ID: 1}
	stack := &portainer.Stack{Name: "web", Type: portainer.DockerComposeStack}
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	deployer := &composeConfigRecordingDeployer{}

	sec := &security.RestrictedRequestContext{
		UserID:  admin.ID,
		IsAdmin: true,
	}

	config, err := CreateComposeStackDeploymentConfigTx(store, sec, stack, endpoint, fileService, deployer, true, true, true)
	require.NoError(t, err)
	require.NotNil(t, config)
	assert.True(t, config.isAdmin)
	assert.Equal(t, admin.ID, config.user.ID)
	assert.True(t, config.prune)
	assert.True(t, config.forcePullImage)
	assert.True(t, config.ForceCreate)
	assert.Len(t, config.registries, 1)
	assert.Same(t, fileService, config.FileService)
	assert.Same(t, deployer, config.StackDeployer)
}

func TestREQ_STK_02_CreateComposeStackDeploymentConfigTx_UserMissing(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)

	_, err = CreateComposeStackDeploymentConfigTx(store, &security.RestrictedRequestContext{UserID: 99}, &portainer.Stack{}, &portainer.Endpoint{ID: 1}, fileService, &composeConfigRecordingDeployer{}, false, false, false)
	require.ErrorContains(t, err, "unable to load user information")
}

func TestREQ_STK_02_ComposeStackDeploymentConfig_Deploy(t *testing.T) {
	t.Parallel()

	projectPath := t.TempDir()
	writeMinimalCompose(t, projectPath)

	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)

	admin := &portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	stack := &portainer.Stack{
		Name:        "web",
		Type:        portainer.DockerComposeStack,
		ProjectPath: projectPath,
		EntryPoint:  "docker-compose.yml",
	}
	endpoint := &portainer.Endpoint{ID: 1}
	deployer := &composeConfigRecordingDeployer{}

	t.Run("nil file service or deployer", func(t *testing.T) {
		cfg := &ComposeStackDeploymentConfig{stack: stack, endpoint: endpoint, user: admin}
		require.ErrorContains(t, cfg.Deploy(t.Context()), "cannot be nil")
	})

	t.Run("local compose deploy", func(t *testing.T) {
		cfg := &ComposeStackDeploymentConfig{
			stack:          stack,
			endpoint:       endpoint,
			user:           admin,
			FileService:    fileService,
			StackDeployer:  deployer,
			prune:          true,
			forcePullImage: true,
			ForceCreate:    true,
		}
		require.NoError(t, cfg.Deploy(t.Context()))
		assert.Equal(t, int32(1), deployer.deployComposeCalls.Load())
		assert.True(t, deployer.lastPrune.Load())
		assert.True(t, deployer.lastForcePull.Load())
		assert.True(t, deployer.lastForceCreate.Load())
	})

	t.Run("deployer error is returned", func(t *testing.T) {
		failing := &composeConfigRecordingDeployer{deployErr: assert.AnError}
		cfg := &ComposeStackDeploymentConfig{
			stack:         stack,
			endpoint:      endpoint,
			user:          admin,
			FileService:   fileService,
			StackDeployer: failing,
		}
		require.ErrorIs(t, cfg.Deploy(t.Context()), assert.AnError)
	})
}

func TestREQ_STK_08_ComposeStackDeploymentConfig_Undeploy(t *testing.T) {
	t.Parallel()

	admin := &portainer.User{ID: 1, Role: portainer.AdministratorRole}
	stack := &portainer.Stack{Name: "web", Type: portainer.DockerComposeStack}
	endpoint := &portainer.Endpoint{ID: 1}

	t.Run("nil deployer", func(t *testing.T) {
		cfg := &ComposeStackDeploymentConfig{stack: stack, endpoint: endpoint, user: admin}
		require.ErrorContains(t, cfg.Undeploy(t.Context()), "cannot be nil")
	})

	t.Run("local compose undeploy", func(t *testing.T) {
		deployer := &composeConfigRecordingDeployer{}
		cfg := &ComposeStackDeploymentConfig{
			stack:         stack,
			endpoint:      endpoint,
			user:          admin,
			StackDeployer: deployer,
		}
		require.NoError(t, cfg.Undeploy(t.Context()))
		assert.Equal(t, int32(1), deployer.undeployComposeCalls.Load())
	})
}

func Test_ComposeStackDeploymentConfig_GetResponse(t *testing.T) {
	t.Parallel()
	assert.Equal(t, "", (&ComposeStackDeploymentConfig{}).GetResponse())
}

func TestREQ_STK_02_ComposeStackDeploymentConfig_Deploy_ValidationAndNilEndpoint(t *testing.T) {
	t.Parallel()

	projectPath := t.TempDir()
	err := os.WriteFile(filesystem.JoinPaths(projectPath, "docker-compose.yml"), []byte("services:\n  web:\n    image: alpine\n    volumes:\n      - /:/host\n"), 0o600)
	require.NoError(t, err)

	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)

	stack := &portainer.Stack{
		Name:        "evil",
		Type:        portainer.DockerComposeStack,
		ProjectPath: projectPath,
		EntryPoint:  "docker-compose.yml",
	}
	user := &portainer.User{ID: 2, Role: portainer.StandardUserRole}
	deployer := &composeConfigRecordingDeployer{}

	cfg := &ComposeStackDeploymentConfig{
		stack:         stack,
		endpoint:      &portainer.Endpoint{ID: 1},
		user:          user,
		FileService:   fileService,
		StackDeployer: deployer,
	}
	err = cfg.Deploy(t.Context())
	require.ErrorContains(t, err, "bind-mount disabled for non administrator users")
	assert.Equal(t, int32(0), deployer.deployComposeCalls.Load())

	// Nil endpoint skips ValidateStackForUser; compose URL validation still runs and passes for a simple file.
	safePath := t.TempDir()
	writeMinimalCompose(t, safePath)
	safeStack := &portainer.Stack{
		Name:        "safe",
		Type:        portainer.DockerComposeStack,
		ProjectPath: safePath,
		EntryPoint:  "docker-compose.yml",
	}
	cfgNilEndpoint := &ComposeStackDeploymentConfig{
		stack:         safeStack,
		endpoint:      nil,
		user:          user,
		FileService:   fileService,
		StackDeployer: deployer,
	}
	require.NoError(t, cfgNilEndpoint.Deploy(t.Context()))
	assert.Equal(t, int32(1), deployer.deployComposeCalls.Load())
}
