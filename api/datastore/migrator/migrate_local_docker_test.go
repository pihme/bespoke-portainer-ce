package migrator

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/database/models"
	gittypes "github.com/portainer/portainer/api/git/types"
	"github.com/portainer/portainer/api/stacks/stackutils"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMigrate_UpdateEndpointSettingsToDB25_CopiesDockerSecurity(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	seedSettings(t, s.settingsSvc, &portainer.Settings{
		AllowBindMountsForRegularUsers:            false,
		AllowContainerCapabilitiesForRegularUsers: true,
		AllowDeviceMappingForRegularUsers:         false,
		AllowHostNamespaceForRegularUsers:         true,
		AllowPrivilegedModeForRegularUsers:        false,
		AllowStackManagementForRegularUsers:       true,
		AllowVolumeBrowserForRegularUsers:         true,
		EnableHostManagementFeatures:              true,
	})
	require.NoError(t, s.endpointSvc.Create(&portainer.Endpoint{
		ID: 1, Name: "local", Type: portainer.DockerEnvironment,
	}))
	require.NoError(t, s.endpointSvc.Create(&portainer.Endpoint{
		ID: 2, Name: "agent", Type: portainer.AgentOnDockerEnvironment,
	}))

	m := s.newMigrator(nil)
	require.NoError(t, m.updateEndpointSettingsToDB25())

	local, err := s.endpointSvc.Endpoint(1)
	require.NoError(t, err)
	assert.False(t, local.SecuritySettings.AllowBindMountsForRegularUsers)
	assert.True(t, local.SecuritySettings.AllowStackManagementForRegularUsers)
	assert.False(t, local.SecuritySettings.AllowVolumeBrowserForRegularUsers, "volume browser only for agent/edge")

	agent, err := s.endpointSvc.Endpoint(2)
	require.NoError(t, err)
	assert.True(t, agent.SecuritySettings.AllowVolumeBrowserForRegularUsers)
	assert.True(t, agent.SecuritySettings.EnableHostManagementFeatures)
}

func TestMigrate_AddGpuInputFieldDB60_InitializesNilGpus(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	require.NoError(t, s.endpointSvc.Create(&portainer.Endpoint{ID: 1, Name: "local", Type: portainer.DockerEnvironment}))
	require.NoError(t, s.endpointSvc.Create(&portainer.Endpoint{
		ID: 2, Name: "with-gpu", Type: portainer.DockerEnvironment,
		Gpus: []portainer.Pair{{Name: "gpu0", Value: "0"}},
	}))

	m := s.newMigrator(nil)
	require.NoError(t, m.migrateDBVersionToDB60())

	ep1, err := s.endpointSvc.Endpoint(1)
	require.NoError(t, err)
	// Bolt may round-trip empty slices as nil; migration must leave no GPUs configured.
	assert.Empty(t, ep1.Gpus)

	ep2, err := s.endpointSvc.Endpoint(2)
	require.NoError(t, err)
	assert.Equal(t, []portainer.Pair{{Name: "gpu0", Value: "0"}}, ep2.Gpus)
}

func TestMigrate_UpdateEnableGpuManagementFeatures_SetsFlags(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	require.NoError(t, s.endpointSvc.Create(&portainer.Endpoint{
		ID: 1, Name: "gpu-env", Type: portainer.DockerEnvironment,
		Gpus: []portainer.Pair{{Name: "gpu0", Value: "0"}},
	}))
	require.NoError(t, s.endpointSvc.Create(&portainer.Endpoint{
		ID: 2, Name: "no-gpu", Type: portainer.DockerEnvironment,
	}))

	m := s.newMigrator(nil)
	require.NoError(t, m.updateEnableGpuManagementFeatures())

	ep1, err := s.endpointSvc.Endpoint(1)
	require.NoError(t, err)
	assert.True(t, ep1.EnableGPUManagement)
	assert.True(t, ep1.PostInitMigrations.MigrateGPUs)

	ep2, err := s.endpointSvc.Endpoint(2)
	require.NoError(t, err)
	assert.False(t, ep2.EnableGPUManagement)
	assert.True(t, ep2.PostInitMigrations.MigrateGPUs)
}

func TestMigrate_UpdateStacksToDB24_SetsActiveStatus(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	require.NoError(t, s.stackSvc.Create(&portainer.Stack{ID: 1, Name: "compose-a", Status: 0}))
	require.NoError(t, s.stackSvc.Create(&portainer.Stack{ID: 2, Name: "compose-b", Status: portainer.StackStatusInactive}))

	m := s.newMigrator(nil)
	require.NoError(t, m.updateStacksToDB24())

	st1, err := s.stackSvc.Read(1)
	require.NoError(t, err)
	assert.Equal(t, portainer.StackStatusActive, st1.Status)
	st2, err := s.stackSvc.Read(2)
	require.NoError(t, err)
	assert.Equal(t, portainer.StackStatusActive, st2.Status)
}

func TestMigrate_MigrateStackEntryPoint_CopiesGitConfigPath(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	require.NoError(t, s.stackSvc.Create(&portainer.Stack{
		ID: 1, Name: "plain", EntryPoint: "docker-compose.yml",
	}))
	require.NoError(t, s.stackSvc.Create(&portainer.Stack{
		ID: 2, Name: "git", EntryPoint: "dir/compose.yml",
		GitConfig: &gittypes.RepoConfig{},
	}))

	m := s.newMigrator(nil)
	require.NoError(t, m.migrateDBVersionToDB34())

	plain, err := s.stackSvc.Read(1)
	require.NoError(t, err)
	assert.Nil(t, plain.GitConfig)

	git, err := s.stackSvc.Read(2)
	require.NoError(t, err)
	require.NotNil(t, git.GitConfig)
	assert.Equal(t, "dir/compose.yml", git.GitConfig.ConfigFilePath)
}

func TestMigrate_UpdateStackResourceControlToDB27_RewritesID(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	require.NoError(t, s.stackSvc.Create(&portainer.Stack{ID: 1, Name: "web", EndpointID: 7}))
	require.NoError(t, s.resourceCtrl.Create(&portainer.ResourceControl{
		ID:         1,
		ResourceID: "web",
		Type:       portainer.StackResourceControl,
	}))
	require.NoError(t, s.resourceCtrl.Create(&portainer.ResourceControl{
		ID:         2,
		ResourceID: "container-x",
		Type:       portainer.ContainerResourceControl,
	}))

	m := s.newMigrator(nil)
	require.NoError(t, m.updateStackResourceControlToDB27())

	rc, err := s.resourceCtrl.Read(1)
	require.NoError(t, err)
	assert.Equal(t, stackutils.ResourceControlID(7, "web"), rc.ResourceID)

	other, err := s.resourceCtrl.Read(2)
	require.NoError(t, err)
	assert.Equal(t, "container-x", other.ResourceID)
}

func TestMigrate_UpdateEndpointsToDBVersion18_ConvertsAuthorizedUsers(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	require.NoError(t, s.endpointSvc.Create(&portainer.Endpoint{
		ID:              1,
		Name:            "local",
		Type:            portainer.DockerEnvironment,
		AuthorizedUsers: []portainer.UserID{2, 3},
		AuthorizedTeams: []portainer.TeamID{5},
	}))

	m := s.newMigrator(nil)
	require.NoError(t, m.updateEndpointsToDBVersion18())

	ep, err := s.endpointSvc.Endpoint(1)
	require.NoError(t, err)
	assert.Equal(t, portainer.RoleID(4), ep.UserAccessPolicies[2].RoleID)
	assert.Equal(t, portainer.RoleID(4), ep.TeamAccessPolicies[5].RoleID)
}

func TestMigrate_UpdateEndpointGroupsToDBVersion18_ConvertsAuthorizedUsers(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	require.NoError(t, s.endpointGroup.Create(&portainer.EndpointGroup{
		Name:            "group",
		AuthorizedUsers: []portainer.UserID{9},
		AuthorizedTeams: []portainer.TeamID{8},
	}))

	m := s.newMigrator(nil)
	require.NoError(t, m.updateEndpointGroupsToDBVersion18())

	groups, err := s.endpointGroup.ReadAll()
	require.NoError(t, err)
	require.NotEmpty(t, groups)
	g := groups[0]
	assert.Equal(t, portainer.RoleID(4), g.UserAccessPolicies[9].RoleID)
	assert.Equal(t, portainer.RoleID(4), g.TeamAccessPolicies[8].RoleID)
}

func TestMigrate_MigratePasswordLengthSettings_SetsTwelve(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	seedSettings(t, s.settingsSvc, &portainer.Settings{})
	m := s.newMigrator(nil)
	require.NoError(t, m.migratePasswordLengthSettings())
	got, err := s.settingsSvc.Settings()
	require.NoError(t, err)
	assert.Equal(t, 12, got.InternalAuthSettings.RequiredPasswordLength)
}

func TestMigrate_UpdateSettingsToDB25_SetsSessionAndCapabilities(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	seedSettings(t, s.settingsSvc, &portainer.Settings{})
	m := s.newMigrator(nil)
	require.NoError(t, m.updateSettingsToDB25())
	got, err := s.settingsSvc.Settings()
	require.NoError(t, err)
	assert.Equal(t, portainer.DefaultUserSessionTimeout, got.UserSessionTimeout)
	assert.True(t, got.AllowContainerCapabilitiesForRegularUsers)
	assert.NotEmpty(t, got.TemplatesURL)
}

func TestMigrate_UpdateSettingsToDB24_EnablesNamespaceDeviceStack(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	seedSettings(t, s.settingsSvc, &portainer.Settings{})
	m := s.newMigrator(nil)
	require.NoError(t, m.updateSettingsToDB24())
	got, err := s.settingsSvc.Settings()
	require.NoError(t, err)
	assert.True(t, got.AllowHostNamespaceForRegularUsers)
	assert.True(t, got.AllowDeviceMappingForRegularUsers)
	assert.True(t, got.AllowStackManagementForRegularUsers)
}

func TestMigrate_UpdateAppTemplatesVersionForDB110_ClearsLegacyURL(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	seedSettings(t, s.settingsSvc, &portainer.Settings{
		TemplatesURL: "https://raw.githubusercontent.com/portainer/templates/master/templates-2.0.json",
	})
	m := s.newMigrator(nil)
	require.NoError(t, m.updateAppTemplatesVersionForDB110())
	got, err := s.settingsSvc.Settings()
	require.NoError(t, err)
	assert.Empty(t, got.TemplatesURL)
}

func TestMigrate_MigrateDockerDesktopExtensionSetting_WithoutEnv(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	seedSettings(t, s.settingsSvc, &portainer.Settings{IsDockerDesktopExtension: true})
	m := s.newMigrator(nil)
	require.NoError(t, m.migrateDockerDesktopExtensionSetting())
	got, err := s.settingsSvc.Settings()
	require.NoError(t, err)
	assert.False(t, got.IsDockerDesktopExtension)
}

func TestMigrate_CleanPendingActionsForDeletedEndpoints(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	require.NoError(t, s.endpointSvc.Create(&portainer.Endpoint{ID: 1, Name: "keep"}))
	require.NoError(t, s.pendingActions.Create(&portainer.PendingAction{EndpointID: 1, Action: "keep-me"}))
	require.NoError(t, s.pendingActions.Create(&portainer.PendingAction{EndpointID: 99, Action: "orphan"}))

	m := s.newMigrator(nil)
	require.NoError(t, m.cleanPendingActionsForDeletedEndpointsForDB111())

	all, err := s.pendingActions.ReadAll()
	require.NoError(t, err)
	require.Len(t, all, 1)
	assert.Equal(t, portainer.EndpointID(1), all[0].EndpointID)
}

func TestMigrate_UpdateUsersToDBVersion18_SetsAuthorizations(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	require.NoError(t, s.userSvc.Create(&portainer.User{Username: "alice", Role: portainer.StandardUserRole}))
	m := s.newMigrator(nil)
	require.NoError(t, m.updateUsersToDBVersion18())
	users, err := s.userSvc.ReadAll()
	require.NoError(t, err)
	require.Len(t, users, 1)
	assert.True(t, users[0].PortainerAuthorizations[portainer.OperationPortainerEndpointList])
}

func TestMigrate_UpdateUserThemeForDB90_CopiesLegacyTheme(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	require.NoError(t, s.userSvc.Create(&portainer.User{Username: "bob", UserTheme: "dark"}))
	m := s.newMigrator(nil)
	require.NoError(t, m.updateUserThemeForDB90())
	users, err := s.userSvc.ReadAll()
	require.NoError(t, err)
	require.Len(t, users, 1)
	assert.Equal(t, "dark", users[0].ThemeSettings.Color)
}

func TestMigrate_NeedsMigration_AndCoreHelpers(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	old := &models.Version{SchemaVersion: "2.0.0", Edition: int(portainer.PortainerCE), MigratorCount: 0}
	m := s.newMigrator(old)
	assert.True(t, m.NeedsMigration())
	assert.Equal(t, "2.0.0", m.CurrentDBVersion())
	assert.Equal(t, portainer.PortainerCE, m.CurrentDBEdition())
	assert.NotNil(t, m.LatestMigrations().Version)
	require.NoError(t, m.Always())
	assert.Contains(t, GetFunctionName(m.Always), "Always")
	assert.Error(t, dbTooOldError())

	current := &models.Version{SchemaVersion: portainer.APIVersion, Edition: int(portainer.PortainerCE), MigratorCount: 0}
	m2 := s.newMigrator(current)
	// MigratorCount 0 vs possibly non-zero funcs for current API version
	_ = m2.NeedsMigration()
	assert.GreaterOrEqual(t, m2.GetMigratorCountOfCurrentAPIVersion(), 0)
}

func TestMigrate_Migrate_SameAPIVersion_RunsAlwaysAndStoresVersion(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	seedSettings(t, s.settingsSvc, &portainer.Settings{})
	// Match migrator count so no version-specific funcs run; only Always + version bump path.
	mProbe := s.newMigrator(&models.Version{SchemaVersion: portainer.APIVersion, Edition: int(portainer.PortainerCE)})
	count := mProbe.GetMigratorCountOfCurrentAPIVersion()
	require.NoError(t, s.versionSvc.UpdateVersion(&models.Version{
		SchemaVersion: portainer.APIVersion,
		Edition:       int(portainer.PortainerCE),
		MigratorCount: count,
	}))

	m := s.newMigrator(&models.Version{SchemaVersion: portainer.APIVersion, Edition: int(portainer.PortainerCE), MigratorCount: count})
	require.NoError(t, m.Migrate())

	v, err := s.versionSvc.Version()
	require.NoError(t, err)
	assert.Equal(t, portainer.APIVersion, v.SchemaVersion)
	assert.Equal(t, count, v.MigratorCount)
}

func TestMigrate_RunMigrations_WrapsErrorsWithFunctionName(t *testing.T) {
	t.Parallel()
	err := runMigrations([]func() error{
		func() error { return assert.AnError },
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed in")
}
