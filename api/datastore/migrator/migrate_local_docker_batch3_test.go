package migrator

import (
	"errors"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/database/models"
	"github.com/portainer/portainer/api/dataservices/edgegroup"
	"github.com/portainer/portainer/api/dataservices/source"
	"github.com/portainer/portainer/api/dataservices/workflow"
	gittypes "github.com/portainer/portainer/api/git/types"

	"github.com/Masterminds/semver/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMigrate_ToRepoConfig_NilAndWithAuth(t *testing.T) {
	t.Parallel()
	assert.Nil(t, (*legacyRepoConfig)(nil).toRepoConfig())

	cfg := (&legacyRepoConfig{
		URL:            "https://github.com/example/repo",
		ReferenceName:  "refs/heads/main",
		ConfigFilePath: "docker-compose.yml",
		ConfigHash:     "abc",
		TLSSkipVerify:  true,
		Authentication: &legacyGitAuthentication{
			Username: "u", Password: "p", Provider: 1, AuthorizationType: 2,
		},
	}).toRepoConfig()
	require.NotNil(t, cfg)
	assert.Equal(t, "https://github.com/example/repo", cfg.URL)
	assert.True(t, cfg.TLSSkipVerify)
	require.NotNil(t, cfg.Authentication)
	assert.Equal(t, "u", cfg.Authentication.Username)
	assert.Equal(t, "p", cfg.Authentication.Password)
	assert.Equal(t, gittypes.GitProvider(1), cfg.Authentication.Provider)
	assert.Equal(t, gittypes.GitCredentialAuthType(2), cfg.Authentication.AuthorizationType)
}

func TestMigrate_GitSourceKey_NormalizesAndFallsBack(t *testing.T) {
	t.Parallel()
	withAuth := gitSourceKey(&gittypes.RepoConfig{
		URL:            "https://github.com/example/repo.git",
		Authentication: &gittypes.GitAuthentication{Username: "alice", Password: "secret"},
	})
	assert.Equal(t, "alice", withAuth.username)
	assert.Equal(t, "secret", withAuth.password)
	assert.NotEmpty(t, withAuth.url)

	raw := "not a url at all ::::"
	fallback := gitSourceKey(&gittypes.RepoConfig{URL: raw})
	assert.Equal(t, raw, fallback.url)
	assert.Empty(t, fallback.username)
}

func TestMigrate_MigrateDBVersionToDB50_WrapperSetsPasswordLength(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	seedSettings(t, s.settingsSvc, &portainer.Settings{
		InternalAuthSettings: portainer.InternalAuthSettings{RequiredPasswordLength: 1},
	})
	m := s.newMigrator(nil)
	require.NoError(t, m.migrateDBVersionToDB50())
	got, err := s.settingsSvc.Settings()
	require.NoError(t, err)
	assert.Equal(t, 12, got.InternalAuthSettings.RequiredPasswordLength)
}

func TestMigrate_Migrate_VersionGap_RunsInjectedMigrations(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	seedSettings(t, s.settingsSvc, &portainer.Settings{})
	require.NoError(t, s.versionSvc.UpdateVersion(&models.Version{
		SchemaVersion: "2.0.0", Edition: int(portainer.PortainerCE), MigratorCount: 0,
	}))

	m := s.newMigrator(&models.Version{SchemaVersion: "2.0.0", Edition: int(portainer.PortainerCE)})
	ran := false
	m.migrations = []Migrations{
		{Version: semver.MustParse("2.1.0"), MigrationFuncs: []func() error{func() error { ran = true; return nil }}},
		{Version: semver.MustParse(portainer.APIVersion), MigrationFuncs: []func() error{func() error { return nil }}},
	}
	require.NoError(t, m.Migrate())
	assert.True(t, ran)

	v, err := s.versionSvc.Version()
	require.NoError(t, err)
	assert.Equal(t, portainer.APIVersion, v.SchemaVersion)
	assert.Equal(t, 1, v.MigratorCount)
}

func TestMigrate_Migrate_SameVersionMigratorCountMismatch_RunsLatest(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	seedSettings(t, s.settingsSvc, &portainer.Settings{})
	require.NoError(t, s.versionSvc.UpdateVersion(&models.Version{
		SchemaVersion: portainer.APIVersion, Edition: int(portainer.PortainerCE), MigratorCount: 0,
	}))

	m := s.newMigrator(&models.Version{
		SchemaVersion: portainer.APIVersion, Edition: int(portainer.PortainerCE), MigratorCount: 0,
	})
	ran := false
	m.migrations = []Migrations{
		{Version: semver.MustParse(portainer.APIVersion), MigrationFuncs: []func() error{
			func() error { ran = true; return nil },
		}},
	}
	require.NoError(t, m.Migrate())
	assert.True(t, ran)
	v, err := s.versionSvc.Version()
	require.NoError(t, err)
	assert.Equal(t, 1, v.MigratorCount)
}

func TestMigrate_Migrate_ErrorsOnMissingOrInvalidVersion(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	m := s.newMigrator(nil)
	err := m.Migrate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed in")

	require.NoError(t, s.versionSvc.UpdateVersion(&models.Version{
		SchemaVersion: "not-a-semver", Edition: int(portainer.PortainerCE),
	}))
	err = m.Migrate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid db schema version")
}

func TestMigrate_NeedsMigration_StaleCountWhenLatestNotCurrentAPI(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	m := s.newMigrator(&models.Version{
		SchemaVersion: portainer.APIVersion,
		Edition:       int(portainer.PortainerCE),
		MigratorCount: 2,
	})
	m.migrations = []Migrations{
		{Version: semver.MustParse("1.0.0"), MigrationFuncs: nil},
	}
	assert.True(t, m.NeedsMigration())

	m2 := s.newMigrator(&models.Version{
		SchemaVersion: portainer.APIVersion,
		Edition:       int(portainer.PortainerCE),
		MigratorCount: 0,
	})
	m2.migrations = []Migrations{
		{Version: semver.MustParse("1.0.0"), MigrationFuncs: nil},
	}
	assert.False(t, m2.NeedsMigration())
}

func TestMigrate_GetValuesForUsers_CreatorAndMembershipErrors(t *testing.T) {
	t.Parallel()
	rc := &portainer.ResourceControl{
		UserAccesses: []portainer.UserResourceAccess{{UserID: 1}},
	}
	users, teams, public, adminOnly, owner := GetValuesForUsersFromResourceOwnershipAndAccesses_2_43_0(
		rc,
		func() (portainer.UserID, portainer.UserRole, error) {
			return 0, 0, errors.New("user missing")
		},
		func(portainer.UserID) ([]portainer.TeamMembership, error) { return nil, nil },
	)
	assert.Equal(t, []portainer.UserID{1}, users)
	assert.Empty(t, teams)
	assert.False(t, public)
	assert.False(t, adminOnly)
	assert.Zero(t, owner)

	_, _, _, _, owner = GetValuesForUsersFromResourceOwnershipAndAccesses_2_43_0(
		rc,
		func() (portainer.UserID, portainer.UserRole, error) {
			return 1, portainer.StandardUserRole, nil
		},
		func(portainer.UserID) ([]portainer.TeamMembership, error) {
			return nil, errors.New("memberships missing")
		},
	)
	assert.Zero(t, owner)
}

func TestMigrate_ClearAutoUpdateInterval_2_44_0_MissingStackAndNilAutoUpdate(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	sourceSvc, err := source.NewService(s.conn)
	require.NoError(t, err)
	workflowSvc, err := workflow.NewService(s.conn)
	require.NoError(t, err)
	m := NewMigrator(&MigratorParameters{
		StackService:    s.stackSvc,
		SourceService:   sourceSvc,
		WorkflowService: workflowSvc,
	})

	require.NoError(t, s.stackSvc.Connection.UpdateTx(func(tx portainer.Transaction) error {
		return m.clearAutoUpdateInterval_2_44_0(tx, 999)
	}))

	require.NoError(t, s.stackSvc.Create(&portainer.Stack{ID: 1, Name: "no-au"}))
	require.NoError(t, s.stackSvc.Connection.UpdateTx(func(tx portainer.Transaction) error {
		return m.clearAutoUpdateInterval_2_44_0(tx, 1)
	}))
}

func TestMigrate_BackfillSourceIntervalForGroup_2_44_0_InvalidDuration(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	sourceSvc, err := source.NewService(s.conn)
	require.NoError(t, err)
	m := NewMigrator(&MigratorParameters{
		StackService:  s.stackSvc,
		SourceService: sourceSvc,
	})
	admin := source.InsecureNewAdminContext()
	err = s.stackSvc.Connection.UpdateTx(func(tx portainer.Transaction) error {
		return m.backfillSourceIntervalForGroup_2_44_0(
			tx, admin, 1, []portainer.StackID{1},
			map[portainer.StackID]string{1: "not-a-duration"},
		)
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse auto update interval")
}

func TestMigrate_BackfillSourceInterval_2_44_0_SkipsDeletedStackRefs(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	sourceSvc, err := source.NewService(s.conn)
	require.NoError(t, err)
	workflowSvc, err := workflow.NewService(s.conn)
	require.NoError(t, err)
	m := NewMigrator(&MigratorParameters{
		StackService:    s.stackSvc,
		SourceService:   sourceSvc,
		WorkflowService: workflowSvc,
	})

	src := &portainer.Source{Type: portainer.SourceTypeGit, Git: &gittypes.GitSource{URL: "https://example.com/r"}}
	require.NoError(t, sourceSvc.Create(source.InsecureNewAdminContext(), src))
	require.NoError(t, workflowSvc.Create(&portainer.Workflow{
		Name: "orphan-ref",
		Artifacts: []portainer.Artifact{{
			StackID: 42, // stack never created
			Files:   []portainer.ArtifactFile{{SourceID: src.ID}},
		}},
	}))
	// Also include a StackID 0 artifact (skipped in collection)
	require.NoError(t, workflowSvc.Create(&portainer.Workflow{
		Name: "zero-stack",
		Artifacts: []portainer.Artifact{{
			StackID: 0,
			Files:   []portainer.ArtifactFile{{SourceID: src.ID}},
		}},
	}))

	require.NoError(t, m.backfillSourceInterval_2_44_0())
}

func TestMigrate_CleanOrphanedWorkflowEnvIDs_2_45_0_LocalEndpoints(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	workflowSvc, err := workflow.NewService(s.conn)
	require.NoError(t, err)
	edgeGroupSvc, err := edgegroup.NewService(s.conn)
	require.NoError(t, err)

	require.NoError(t, s.endpointSvc.Create(&portainer.Endpoint{ID: 1, Name: "keep", Type: portainer.DockerEnvironment}))
	require.NoError(t, workflowSvc.Create(&portainer.Workflow{
		Name: "wf",
		Artifacts: []portainer.Artifact{{
			EnvIDs:     []portainer.EndpointID{1, 99},
			EdgeGroups: nil,
		}},
	}))

	m := NewMigrator(&MigratorParameters{
		EndpointService:   s.endpointSvc,
		WorkflowService:   workflowSvc,
		EdgeGroupService:  edgeGroupSvc,
		StackService:      s.stackSvc,
	})
	require.NoError(t, m.cleanOrphanedWorkflowReferences_2_45_0())

	wfs, err := workflowSvc.ReadAll()
	require.NoError(t, err)
	require.Len(t, wfs, 1)
	assert.Equal(t, []portainer.EndpointID{1}, wfs[0].Artifacts[0].EnvIDs)
}

func TestMigrate_PruneOrphanedStackArtifacts_2_45_0_DeletesEmptyWorkflow(t *testing.T) {
	t.Parallel()
	s := openTestServices(t)
	workflowSvc, err := workflow.NewService(s.conn)
	require.NoError(t, err)

	require.NoError(t, s.stackSvc.Create(&portainer.Stack{ID: 1, Name: "keep"}))
	require.NoError(t, workflowSvc.Create(&portainer.Workflow{
		Name: "partial",
		Artifacts: []portainer.Artifact{
			{StackID: 1},
			{StackID: 99}, // orphan
		},
	}))
	require.NoError(t, workflowSvc.Create(&portainer.Workflow{
		Name:      "all-orphan",
		Artifacts: []portainer.Artifact{{StackID: 88}},
	}))

	m := NewMigrator(&MigratorParameters{
		StackService:    s.stackSvc,
		WorkflowService: workflowSvc,
	})
	require.NoError(t, m.pruneOrphanedStackArtifacts_2_45_0())

	wfs, err := workflowSvc.ReadAll()
	require.NoError(t, err)
	require.Len(t, wfs, 1)
	assert.Equal(t, "partial", wfs[0].Name)
	require.Len(t, wfs[0].Artifacts, 1)
	assert.Equal(t, portainer.StackID(1), wfs[0].Artifacts[0].StackID)
}
