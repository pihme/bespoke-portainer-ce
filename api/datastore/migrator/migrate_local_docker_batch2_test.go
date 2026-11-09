package migrator

import (
	"os"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/database/models"

	"github.com/docker/docker/api/types/system"
	"github.com/docker/docker/api/types/volume"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMigrate_UpdateVolumeResourceControlToDB32_RewritesMatchingAndDeletesOrphans(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)

	dockerID := "docker-id-abc"
	volName := "data-vol"
	createdAt := "2020-01-01T00:00:00Z"
	oldID := volName + createdAt

	require.NoError(t, s.resourceCtrl.Create(&portainer.ResourceControl{
		ResourceID: oldID,
		Type:       portainer.VolumeResourceControl,
	}))
	require.NoError(t, s.resourceCtrl.Create(&portainer.ResourceControl{
		ResourceID: "orphan-vol-legacy",
		Type:       portainer.VolumeResourceControl,
	}))
	require.NoError(t, s.resourceCtrl.Create(&portainer.ResourceControl{
		ResourceID: "container-1",
		Type:       portainer.ContainerResourceControl,
	}))

	require.NoError(t, s.endpointSvc.Create(&portainer.Endpoint{
		ID:   1,
		Name: "local",
		Type: portainer.DockerEnvironment,
		Snapshots: []portainer.DockerSnapshot{{
			Swarm: false,
			SnapshotRaw: portainer.DockerSnapshotRaw{
				Info: system.Info{ID: dockerID},
				Volumes: volume.ListResponse{
					Volumes: []*volume.Volume{{
						Name:      volName,
						CreatedAt: createdAt,
					}},
				},
			},
		}},
	}))
	// Non-docker endpoint skipped; empty snapshot skipped.
	require.NoError(t, s.endpointSvc.Create(&portainer.Endpoint{
		ID: 2, Name: "k8s", Type: portainer.KubernetesLocalEnvironment,
	}))
	require.NoError(t, s.endpointSvc.Create(&portainer.Endpoint{
		ID: 3, Name: "no-snap", Type: portainer.DockerEnvironment,
	}))

	m := s.newMigrator(nil)
	require.NoError(t, m.updateVolumeResourceControlToDB32())

	all, err := s.resourceCtrl.ReadAll()
	require.NoError(t, err)
	require.Len(t, all, 2)

	byType := map[portainer.ResourceControlType]portainer.ResourceControl{}
	for _, rc := range all {
		byType[rc.Type] = rc
	}
	assert.Equal(t, volName+"_"+dockerID, byType[portainer.VolumeResourceControl].ResourceID)
	assert.Equal(t, "container-1", byType[portainer.ContainerResourceControl].ResourceID)
}

func TestMigrate_FindResourcesToUpdateForDB32_MatchesLegacyVolumeID(t *testing.T) {
	t.Parallel()
	toUpdate := map[portainer.ResourceControlID]string{}
	rc := &portainer.ResourceControl{ID: 7, ResourceID: "vol2020-01-01T00:00:00Z"}
	volumeResourceControls := map[string]*portainer.ResourceControl{
		"vol2020-01-01T00:00:00Z": rc,
	}
	findResourcesToUpdateForDB32("did", volume.ListResponse{
		Volumes: []*volume.Volume{{Name: "vol", CreatedAt: "2020-01-01T00:00:00Z"}},
	}, toUpdate, volumeResourceControls)
	assert.Equal(t, "vol_did", toUpdate[7])
}

func TestMigrate_UpdateTagsToDBVersion23_InitializesMaps(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	require.NoError(t, s.tagSvc.Create(&portainer.Tag{Name: "prod"}))
	require.NoError(t, s.tagSvc.Create(&portainer.Tag{Name: "dev"}))

	m := s.newMigrator(nil)
	require.NoError(t, m.updateTagsToDBVersion23())

	tags, err := s.tagSvc.ReadAll()
	require.NoError(t, err)
	require.Len(t, tags, 2)
	for _, tag := range tags {
		require.NotNil(t, tag.Endpoints)
		require.NotNil(t, tag.EndpointGroups)
		assert.Empty(t, tag.Endpoints)
		assert.Empty(t, tag.EndpointGroups)
	}
}

func TestMigrate_UpdateEndpointsAndEndpointGroupsToDBVersion23_ConvertsTagNames(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	require.NoError(t, s.tagSvc.Create(&portainer.Tag{
		Name: "web", Endpoints: map[portainer.EndpointID]bool{}, EndpointGroups: map[portainer.EndpointGroupID]bool{},
	}))
	tags, err := s.tagSvc.ReadAll()
	require.NoError(t, err)
	require.Len(t, tags, 1)
	tagID := tags[0].ID

	require.NoError(t, s.endpointSvc.Create(&portainer.Endpoint{
		ID: 1, Name: "local", Type: portainer.DockerEnvironment, Tags: []string{"web", "missing"},
	}))
	require.NoError(t, s.endpointGroup.Create(&portainer.EndpointGroup{
		Name: "g1", Tags: []string{"web"},
	}))

	m := s.newMigrator(nil)
	require.NoError(t, m.updateEndpointsAndEndpointGroupsToDBVersion23())

	ep, err := s.endpointSvc.Endpoint(1)
	require.NoError(t, err)
	assert.Equal(t, []portainer.TagID{tagID}, ep.TagIDs)

	rel, err := s.endpointRel.EndpointRelation(1)
	require.NoError(t, err)
	assert.Equal(t, portainer.EndpointID(1), rel.EndpointID)
	require.NotNil(t, rel.EdgeStacks)

	groups, err := s.endpointGroup.ReadAll()
	require.NoError(t, err)
	require.Len(t, groups, 1)
	assert.Equal(t, []portainer.TagID{tagID}, groups[0].TagIDs)

	updatedTag, err := s.tagSvc.Read(tagID)
	require.NoError(t, err)
	assert.True(t, updatedTag.Endpoints[1])
	assert.True(t, updatedTag.EndpointGroups[groups[0].ID])
}

func TestMigrate_UpdateResourceControlsToDBVersion22_ClearsAdministratorsOnly(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	require.NoError(t, s.resourceCtrl.Create(&portainer.ResourceControl{
		ResourceID: "r1", Type: portainer.ContainerResourceControl, AdministratorsOnly: true,
	}))
	require.NoError(t, s.resourceCtrl.Create(&portainer.ResourceControl{
		ResourceID: "r2", Type: portainer.VolumeResourceControl, AdministratorsOnly: true,
	}))

	m := s.newMigrator(nil)
	require.NoError(t, m.updateResourceControlsToDBVersion22())

	all, err := s.resourceCtrl.ReadAll()
	require.NoError(t, err)
	for _, rc := range all {
		assert.False(t, rc.AdministratorsOnly)
	}
}

func TestMigrate_UpdateUsersAndRolesToDBVersion22_SetsPrioritiesAndAuthz(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	seedSettings(t, s.settingsSvc, &portainer.Settings{AllowVolumeBrowserForRegularUsers: true})
	seedRoles1to4(t, s.roleSvc)
	require.NoError(t, s.userSvc.Create(&portainer.User{Username: "alice", Role: portainer.StandardUserRole}))

	m := s.newMigrator(nil)
	require.NoError(t, m.updateUsersAndRolesToDBVersion22())

	users, err := s.userSvc.ReadAll()
	require.NoError(t, err)
	require.Len(t, users, 1)
	assert.True(t, users[0].PortainerAuthorizations[portainer.OperationPortainerEndpointList])

	for id, wantPriority := range map[portainer.RoleID]int{1: 1, 2: 2, 3: 3, 4: 4} {
		role, err := s.roleSvc.Read(id)
		require.NoError(t, err)
		assert.Equal(t, wantPriority, role.Priority)
		assert.NotEmpty(t, role.Authorizations)
	}
}

func TestMigrate_UpdateSettingsToDBVersion20_DisablesVolumeBrowser(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	seedSettings(t, s.settingsSvc, &portainer.Settings{AllowVolumeBrowserForRegularUsers: true})
	m := s.newMigrator(nil)
	require.NoError(t, m.updateSettingsToDBVersion20())
	got, err := s.settingsSvc.Settings()
	require.NoError(t, err)
	assert.False(t, got.AllowVolumeBrowserForRegularUsers)
}

func TestMigrate_UpdateUsersToDBVersion20_CallsAuthorizationNoOp(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	m := s.newMigrator(nil)
	require.NoError(t, m.updateUsersToDBVersion20())
}

func TestMigrate_UpdateSchedulesToDBVersion20_RewritesCronExpressions(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	cases := []struct {
		id   portainer.ScheduleID
		cron string
		want string
	}{
		{1, "0 0 * * *", "0 * * * *"},
		{2, "0 0 0/2 * *", "0 */2 * * *"},
		{3, "0 0 0 * *", "0 0 * * *"},
		{4, "0 15 * * * *", "15 * * * *"}, // 6-field → drop first
		{5, "0 15 * * *", "0 15 * * *"},   // already 5-field script job left alone
		{6, "0 * * * *", "0 * * * *"},     // non-script job type unchanged below
	}
	for _, tc := range cases {
		jobType := portainer.JobType(scheduleScriptExecutionJobType)
		if tc.id == 6 {
			jobType = portainer.SnapshotJobType
		}
		require.NoError(t, s.scheduleSvc.CreateSchedule(&portainer.Schedule{
			ID: tc.id, CronExpression: tc.cron, JobType: jobType,
		}))
	}

	m := s.newMigrator(nil)
	require.NoError(t, m.updateSchedulesToDBVersion20())

	for _, tc := range cases {
		got, err := s.scheduleSvc.Schedule(tc.id)
		require.NoError(t, err)
		assert.Equal(t, tc.want, got.CronExpression, "schedule %d", tc.id)
	}
}

func TestMigrate_ConvertSeedToPrivateKeyForDB100_NotFoundBlankAndSeed(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	m := s.newMigrator(nil)

	// Object not found → success no-op
	require.NoError(t, m.convertSeedToPrivateKeyForDB100())

	// Blank seed → clear stays blank
	require.NoError(t, s.tunnelSvc.UpdateInfo(&portainer.TunnelServerInfo{PrivateKeySeed: ""}))
	require.NoError(t, m.convertSeedToPrivateKeyForDB100())
	info, err := s.tunnelSvc.Info()
	require.NoError(t, err)
	assert.Empty(t, info.PrivateKeySeed)

	// With seed → file written and seed cleared
	require.NoError(t, s.tunnelSvc.UpdateInfo(&portainer.TunnelServerInfo{PrivateKeySeed: "94qh17MCIk8BOkiI"}))
	require.NoError(t, m.convertSeedToPrivateKeyForDB100())
	info, err = s.tunnelSvc.Info()
	require.NoError(t, err)
	assert.Empty(t, info.PrivateKeySeed)

	keyPath := s.fileSvc.GetDefaultChiselPrivateKeyPath()
	st, err := os.Stat(keyPath)
	require.NoError(t, err)
	assert.Greater(t, st.Size(), int64(0))
}

func TestMigrate_ApplyUACOnSourceUpdate_2_43_0_Branches(t *testing.T) {
	t.Parallel()

	t.Run("public_incoming_makes_source_public", func(t *testing.T) {
		src := &portainer.Source{UserAccesses: []portainer.UserID{1}, TeamAccesses: []portainer.TeamID{2}}
		ApplyUACOnSourceUpdate_2_43_0(src, nil, nil, true, false, 1)
		assert.True(t, src.Public)
		assert.False(t, src.AdministratorsOnly)
		assert.Empty(t, src.UserAccesses)
		assert.Empty(t, src.TeamAccesses)
	})

	t.Run("already_public_source_stays_public", func(t *testing.T) {
		src := &portainer.Source{Public: true, UserAccesses: []portainer.UserID{9}}
		ApplyUACOnSourceUpdate_2_43_0(src, []portainer.UserID{1}, nil, false, false, 1)
		assert.True(t, src.Public)
		assert.Empty(t, src.UserAccesses)
	})

	t.Run("admin_only_incoming_leaves_accesses_and_sets_admin_when_empty", func(t *testing.T) {
		src := &portainer.Source{}
		ApplyUACOnSourceUpdate_2_43_0(src, []portainer.UserID{1}, []portainer.TeamID{2}, false, true, 1)
		assert.True(t, src.AdministratorsOnly)
		assert.Equal(t, portainer.UserID(0), src.OwnerID)
		assert.Empty(t, src.UserAccesses)
	})

	t.Run("single_matching_owner_gets_ownership", func(t *testing.T) {
		src := &portainer.Source{AdministratorsOnly: true}
		ApplyUACOnSourceUpdate_2_43_0(src, []portainer.UserID{5}, nil, false, false, 5)
		assert.Equal(t, portainer.UserID(5), src.OwnerID)
		assert.False(t, src.AdministratorsOnly)
		assert.Equal(t, []portainer.UserID{5}, src.UserAccesses)
	})

	t.Run("multiple_accesses_clear_owner", func(t *testing.T) {
		src := &portainer.Source{OwnerID: 5, UserAccesses: []portainer.UserID{5}}
		ApplyUACOnSourceUpdate_2_43_0(src, []portainer.UserID{6}, nil, false, false, 5)
		assert.Equal(t, portainer.UserID(0), src.OwnerID)
		assert.ElementsMatch(t, []portainer.UserID{5, 6}, src.UserAccesses)
	})
}

func TestMigrate_GetValuesForUsersFromResourceOwnership_2_43_0(t *testing.T) {
	t.Parallel()

	users, teams, public, adminOnly, owner := GetValuesForUsersFromResourceOwnershipAndAccesses_2_43_0(
		nil,
		func() (portainer.UserID, portainer.UserRole, error) { return 0, 0, nil },
		func(portainer.UserID) ([]portainer.TeamMembership, error) { return nil, nil },
	)
	assert.True(t, adminOnly)
	assert.False(t, public)
	assert.Empty(t, users)
	assert.Empty(t, teams)
	assert.Zero(t, owner)

	users, teams, public, adminOnly, owner = GetValuesForUsersFromResourceOwnershipAndAccesses_2_43_0(
		&portainer.ResourceControl{Public: true, AdministratorsOnly: false},
		func() (portainer.UserID, portainer.UserRole, error) { return 1, portainer.StandardUserRole, nil },
		func(portainer.UserID) ([]portainer.TeamMembership, error) { return nil, nil },
	)
	assert.True(t, public)
	assert.False(t, adminOnly)
	assert.Empty(t, users)
	assert.Zero(t, owner)

	users, teams, public, adminOnly, owner = GetValuesForUsersFromResourceOwnershipAndAccesses_2_43_0(
		&portainer.ResourceControl{
			AdministratorsOnly: false,
			Public:             false,
			UserAccesses:       []portainer.UserResourceAccess{{UserID: 3}},
			TeamAccesses:       []portainer.TeamResourceAccess{{TeamID: 8}},
		},
		func() (portainer.UserID, portainer.UserRole, error) {
			return 3, portainer.StandardUserRole, nil
		},
		func(portainer.UserID) ([]portainer.TeamMembership, error) {
			return []portainer.TeamMembership{{TeamID: 8}}, nil
		},
	)
	assert.False(t, public)
	assert.False(t, adminOnly)
	assert.Equal(t, []portainer.UserID{3}, users)
	assert.Equal(t, []portainer.TeamID{8}, teams)
	assert.Equal(t, portainer.UserID(3), owner)

	// Admin creator does not become owner
	_, _, _, _, owner = GetValuesForUsersFromResourceOwnershipAndAccesses_2_43_0(
		&portainer.ResourceControl{
			UserAccesses: []portainer.UserResourceAccess{{UserID: 1}},
		},
		func() (portainer.UserID, portainer.UserRole, error) {
			return 1, portainer.AdministratorRole, nil
		},
		func(portainer.UserID) ([]portainer.TeamMembership, error) { return nil, nil },
	)
	assert.Zero(t, owner)
}

func TestMigrate_NeedsMigration_MigratorCountMismatchAndStaleCount(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)

	probe := s.newMigrator(&models.Version{SchemaVersion: portainer.APIVersion, Edition: int(portainer.PortainerCE)})
	latest := probe.LatestMigrations()
	if latest.Version.String() == portainer.APIVersion && len(latest.MigrationFuncs) > 0 {
		m := s.newMigrator(&models.Version{
			SchemaVersion: portainer.APIVersion,
			Edition:       int(portainer.PortainerCE),
			MigratorCount: 0,
		})
		assert.True(t, m.NeedsMigration(), "mismatched MigratorCount should need migration")

		mOk := s.newMigrator(&models.Version{
			SchemaVersion: portainer.APIVersion,
			Edition:       int(portainer.PortainerCE),
			MigratorCount: len(latest.MigrationFuncs),
		})
		assert.False(t, mOk.NeedsMigration())
	} else {
		// No funcs for current API version: stale MigratorCount > 0 still needs migration
		m := s.newMigrator(&models.Version{
			SchemaVersion: portainer.APIVersion,
			Edition:       int(portainer.PortainerCE),
			MigratorCount: 3,
		})
		assert.True(t, m.NeedsMigration())
	}
}

func TestMigrate_UpdateSettingsToDBVersion19_SetsEdgeCheckinDefault(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	seedSettings(t, s.settingsSvc, &portainer.Settings{EdgeAgentCheckinInterval: 0})
	m := s.newMigrator(nil)
	require.NoError(t, m.updateSettingsToDBVersion19())
	got, err := s.settingsSvc.Settings()
	require.NoError(t, err)
	assert.Equal(t, portainer.DefaultEdgeAgentCheckinIntervalInSeconds, got.EdgeAgentCheckinInterval)

	seedSettings(t, s.settingsSvc, &portainer.Settings{EdgeAgentCheckinInterval: 42})
	require.NoError(t, m.updateSettingsToDBVersion19())
	got, err = s.settingsSvc.Settings()
	require.NoError(t, err)
	assert.Equal(t, 42, got.EdgeAgentCheckinInterval)
}

func TestMigrate_MigrateSettingsToDB30_ClearsOAuthSSO(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	seedSettings(t, s.settingsSvc, &portainer.Settings{
		OAuthSettings: portainer.OAuthSettings{SSO: true, LogoutURI: "https://example/logout"},
	})
	m := s.newMigrator(nil)
	require.NoError(t, m.migrateDBVersionToDB30())
	got, err := s.settingsSvc.Settings()
	require.NoError(t, err)
	assert.False(t, got.OAuthSettings.SSO)
	assert.Empty(t, got.OAuthSettings.LogoutURI)
}

func TestMigrate_MigrateUsersToDB36_AddsTokenAuthorizations(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	require.NoError(t, s.userSvc.Create(&portainer.User{Username: "tok", Role: portainer.StandardUserRole}))
	m := s.newMigrator(nil)
	require.NoError(t, m.migrateDBVersionToDB36())
	users, err := s.userSvc.ReadAll()
	require.NoError(t, err)
	require.Len(t, users, 1)
	assert.True(t, users[0].PortainerAuthorizations[portainer.OperationPortainerUserListToken])
	assert.True(t, users[0].PortainerAuthorizations[portainer.OperationPortainerUserCreateToken])
	assert.True(t, users[0].PortainerAuthorizations[portainer.OperationPortainerUserRevokeToken])
}

func TestMigrate_MigratePendingActionsDataForDB130_MarshalsActionData(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	require.NoError(t, s.pendingActions.Create(&portainer.PendingAction{
		EndpointID: 1,
		Action:     "example",
		ActionData: map[string]any{"k": "v", "n": float64(1)},
	}))

	m := s.newMigrator(nil)
	require.NoError(t, m.migratePendingActionsDataForDB130())

	all, err := s.pendingActions.ReadAll()
	require.NoError(t, err)
	require.Len(t, all, 1)
	asString, ok := all[0].ActionData.(string)
	require.True(t, ok, "ActionData should be JSON-encoded string after migration, got %T", all[0].ActionData)
	assert.NotEmpty(t, asString)
}
