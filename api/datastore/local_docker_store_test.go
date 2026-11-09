package datastore

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	portainerErrors "github.com/portainer/portainer/api/dataservices/errors"
	"github.com/portainer/portainer/api/dataservices/source"
	gittypes "github.com/portainer/portainer/api/git/types"

	"github.com/stretchr/testify/require"
)

// Backwards-compatibility: Store getters for local-Docker layers are wired after Open.
func TestStore_LocalServiceAccessorsAreWired(t *testing.T) {
	t.Parallel()
	_, store := MustNewTestStore(t, true, false)

	require.NotNil(t, store.AllowList())
	require.NotNil(t, store.CustomTemplate())
	require.NotNil(t, store.Endpoint())
	require.NotNil(t, store.EndpointGroup())
	require.NotNil(t, store.EndpointRelation())
	require.NotNil(t, store.PendingActions())
	require.NotNil(t, store.ResourceControl())
	require.NotNil(t, store.Role())
	require.NotNil(t, store.Settings())
	require.NotNil(t, store.Snapshot())
	require.NotNil(t, store.Source())
	require.NotNil(t, store.SSLSettings())
	require.NotNil(t, store.Stack())
	require.NotNil(t, store.Tag())
	require.NotNil(t, store.Version())
	require.NotNil(t, store.Webhook())
	require.NotNil(t, store.Workflow())
	require.NotNil(t, store.APIKeyRepository())

	// Deferred-feature getters stay wired on the store (observed wiring only).
	require.NotNil(t, store.EdgeGroup())
	require.NotNil(t, store.EdgeJob())
	require.NotNil(t, store.EdgeStack())
	require.NotNil(t, store.EdgeStackStatus())
	require.NotNil(t, store.HelmUserRepository())
	require.NotNil(t, store.Registry())
	require.NotNil(t, store.Team())
	require.NotNil(t, store.TeamMembership())
	require.NotNil(t, store.TunnelServer())
	require.NotNil(t, store.User())
}

// Backwards-compatibility: UpdateTx/ViewTx expose local-Docker services through StoreTx.
func TestStore_UpdateTxAndViewTx_LocalDockerEntities(t *testing.T) {
	t.Parallel()
	_, store := MustNewTestStore(t, true, false)

	endpointID := portainer.EndpointID(store.Endpoint().GetNextIdentifier())
	endpoint := &portainer.Endpoint{
		ID:      endpointID,
		Name:    "local-docker",
		URL:     "unix:///var/run/docker.sock",
		Type:    portainer.DockerEnvironment,
		GroupID: 1,
		Status:  portainer.EndpointStatusUp,
	}

	stackID := portainer.StackID(store.Stack().GetNextIdentifier())
	stack := &portainer.Stack{
		ID:          stackID,
		Name:        "compose-app",
		Type:        portainer.DockerComposeStack,
		EndpointID:  endpointID,
		EntryPoint:  "docker-compose.yml",
		Status:      portainer.StackStatusActive,
		ProjectPath: "/data/compose/compose-app",
		CreatedBy:   "admin",
	}

	rc := &portainer.ResourceControl{
		ResourceID:         "container-abc",
		SubResourceIDs:     []string{},
		Type:               portainer.ContainerResourceControl,
		UserAccesses:       []portainer.UserResourceAccess{},
		TeamAccesses:       []portainer.TeamResourceAccess{},
		Public:             false,
		AdministratorsOnly: true,
	}

	tag := &portainer.Tag{
		Name:           "prod",
		Endpoints:      map[portainer.EndpointID]bool{},
		EndpointGroups: map[portainer.EndpointGroupID]bool{},
	}

	snap := &portainer.Snapshot{
		EndpointID: endpointID,
		Docker: &portainer.DockerSnapshot{
			TotalCPU:    4,
			TotalMemory: 8 * 1024 * 1024 * 1024,
		},
	}

	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.True(t, tx.IsErrObjectNotFound(portainerErrors.ErrObjectNotFound))
		require.False(t, tx.IsErrObjectNotFound(errors.New("other")))

		require.NotNil(t, tx.AllowList())
		require.NotNil(t, tx.CustomTemplate())
		require.NotNil(t, tx.PendingActions())
		require.NotNil(t, tx.Endpoint())
		require.NotNil(t, tx.EndpointGroup())
		require.NotNil(t, tx.EndpointRelation())
		require.NotNil(t, tx.ResourceControl())
		require.NotNil(t, tx.Role())
		require.NotNil(t, tx.Settings())
		require.NotNil(t, tx.Snapshot())
		require.NotNil(t, tx.Source())
		require.NotNil(t, tx.SSLSettings())
		require.NotNil(t, tx.Stack())
		require.NotNil(t, tx.Tag())
		require.NotNil(t, tx.Workflow())

		// Observed StoreTx stubs for services without tx wrappers.
		require.Nil(t, tx.HelmUserRepository())
		require.Nil(t, tx.APIKeyRepository())
		require.Nil(t, tx.TunnelServer())
		require.Nil(t, tx.Version())
		require.Nil(t, tx.Webhook())

		// Deferred-feature tx getters remain callable (wiring only).
		require.NotNil(t, tx.EdgeGroup())
		require.NotNil(t, tx.EdgeJob())
		require.NotNil(t, tx.EdgeStack())
		require.NotNil(t, tx.EdgeStackStatus())
		require.NotNil(t, tx.Registry())
		require.NotNil(t, tx.Team())
		require.NotNil(t, tx.TeamMembership())
		require.NotNil(t, tx.User())

		if err := tx.Endpoint().Create(endpoint); err != nil {
			return err
		}
		if err := tx.EndpointRelation().Create(&portainer.EndpointRelation{
			EndpointID: endpointID,
			EdgeStacks: map[portainer.EdgeStackID]bool{},
		}); err != nil {
			return err
		}
		if err := tx.Stack().Create(stack); err != nil {
			return err
		}
		if err := tx.ResourceControl().Create(rc); err != nil {
			return err
		}
		if err := tx.Tag().Create(tag); err != nil {
			return err
		}
		if err := tx.Snapshot().Create(snap); err != nil {
			return err
		}
		if rc.ID == 0 || tag.ID == 0 {
			return errors.New("expected Create to assign resource control and tag IDs")
		}

		settings, err := tx.Settings().Settings()
		if err != nil {
			return err
		}
		settings.SnapshotInterval = "7m"
		return tx.Settings().UpdateSettings(settings)
	})
	require.NoError(t, err)

	err = store.ViewTx(func(tx dataservices.DataStoreTx) error {
		gotEndpoint, err := tx.Endpoint().Endpoint(endpointID)
		if err != nil {
			return err
		}
		require.Equal(t, "local-docker", gotEndpoint.Name)
		require.Equal(t, portainer.DockerEnvironment, gotEndpoint.Type)

		gotStack, err := tx.Stack().Read(stackID)
		if err != nil {
			return err
		}
		require.Equal(t, "compose-app", gotStack.Name)
		require.Equal(t, portainer.DockerComposeStack, gotStack.Type)

		gotRC, err := tx.ResourceControl().Read(rc.ID)
		if err != nil {
			return err
		}
		require.Equal(t, "container-abc", gotRC.ResourceID)

		gotTag, err := tx.Tag().Read(tag.ID)
		if err != nil {
			return err
		}
		require.Equal(t, "prod", gotTag.Name)

		gotSnap, err := tx.Snapshot().Read(endpointID)
		if err != nil {
			return err
		}
		require.NotNil(t, gotSnap.Docker)
		require.Equal(t, 4, gotSnap.Docker.TotalCPU)

		settings, err := tx.Settings().Settings()
		if err != nil {
			return err
		}
		require.Equal(t, "7m", settings.SnapshotInterval)
		return nil
	})
	require.NoError(t, err)
}

func TestStore_CheckCurrentEditionAndConnection(t *testing.T) {
	t.Parallel()
	_, store := MustNewTestStore(t, true, false)

	require.Same(t, store.connection, store.Connection())
	require.Equal(t, store.connection.GetDatabaseFilePath(), store.databasePath())

	require.NoError(t, store.CheckCurrentEdition())
	require.Equal(t, portainer.PortainerCE, store.edition())

	updateEdition(store, portainer.PortainerBE)
	require.ErrorIs(t, store.CheckCurrentEdition(), portainerErrors.ErrWrongDBEdition)
	require.Equal(t, portainer.PortainerBE, store.edition())

	// Missing version object falls back to CE.
	require.NoError(t, store.connection.DeleteObject("version", []byte("VERSION")))
	require.Equal(t, portainer.PortainerCE, store.edition())
	require.NoError(t, store.CheckCurrentEdition())
}

func TestStore_BackupToWriter(t *testing.T) {
	t.Parallel()
	_, store := MustNewTestStore(t, true, false)

	var buf bytes.Buffer
	require.NoError(t, store.BackupTo(&buf))
	require.NotEmpty(t, buf.Bytes())
}

func TestStore_IsErrObjectNotFound(t *testing.T) {
	t.Parallel()
	_, store := MustNewTestStore(t, true, false)

	require.True(t, store.IsErrObjectNotFound(portainerErrors.ErrObjectNotFound))
	require.True(t, store.IsErrObjectNotFound(errors.Join(portainerErrors.ErrObjectNotFound, errors.New("wrap"))))
	require.False(t, store.IsErrObjectNotFound(errors.New("nope")))
}

// Backwards-compatibility: Export/Import round-trip preserves local Docker store data.
func TestStore_ExportImport_LocalDockerRoundTrip(t *testing.T) {
	t.Parallel()
	_, store := MustNewTestStore(t, true, false)

	endpointID := portainer.EndpointID(store.Endpoint().GetNextIdentifier())
	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:      endpointID,
		Name:    "export-local",
		URL:     "unix:///var/run/docker.sock",
		Type:    portainer.DockerEnvironment,
		GroupID: 1,
		Status:  portainer.EndpointStatusUp,
	}))
	require.NoError(t, store.EndpointRelation().Create(&portainer.EndpointRelation{
		EndpointID: endpointID,
		EdgeStacks: map[portainer.EdgeStackID]bool{},
	}))

	stackID := portainer.StackID(store.Stack().GetNextIdentifier())
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID:          stackID,
		Name:        "export-compose",
		Type:        portainer.DockerComposeStack,
		EndpointID:  endpointID,
		EntryPoint:  "docker-compose.yml",
		Status:      portainer.StackStatusActive,
		ProjectPath: "/data/compose/export-compose",
		CreatedBy:   "admin",
	}))

	rc := &portainer.ResourceControl{
		ResourceID:         "vol-xyz",
		SubResourceIDs:     []string{},
		Type:               portainer.VolumeResourceControl,
		UserAccesses:       []portainer.UserResourceAccess{},
		TeamAccesses:       []portainer.TeamResourceAccess{},
		AdministratorsOnly: true,
	}
	require.NoError(t, store.ResourceControl().Create(rc))
	rcID := rc.ID

	require.NoError(t, store.Snapshot().Create(&portainer.Snapshot{
		EndpointID: endpointID,
		Docker:     &portainer.DockerSnapshot{TotalCPU: 2},
	}))

	tag := &portainer.Tag{
		Name:           "export-tag",
		Endpoints:      map[portainer.EndpointID]bool{endpointID: true},
		EndpointGroups: map[portainer.EndpointGroupID]bool{},
	}
	require.NoError(t, store.Tag().Create(tag))
	tagID := tag.ID

	tplID := portainer.CustomTemplateID(store.CustomTemplate().GetNextIdentifier())
	require.NoError(t, store.CustomTemplate().Create(&portainer.CustomTemplate{
		ID:          tplID,
		Title:       "export-tpl",
		Description: "desc",
		ProjectPath: "/data/custom_template/1",
		EntryPoint:  "docker-compose.yml",
	}))

	role := &portainer.Role{
		Name:        "readonly",
		Description: "read only",
	}
	require.NoError(t, store.Role().Create(role))
	roleID := role.ID

	wf := &portainer.Workflow{
		Name: "export-wf",
	}
	require.NoError(t, store.Workflow().Create(wf))
	wfID := wf.ID

	webhook := &portainer.Webhook{
		Token:       "tok-export",
		ResourceID:  "svc-1",
		EndpointID:  endpointID,
		WebhookType: 1,
	}
	require.NoError(t, store.Webhook().Create(webhook))
	webhookID := webhook.ID

	adminCtx := source.InsecureNewAdminContext()
	src := &portainer.Source{
		Name: "export-src",
		Type: portainer.SourceTypeGit,
		Git: &gittypes.GitSource{
			URL: "https://github.com/example/compose.git",
		},
		Public:             true,
		AdministratorsOnly: false,
	}
	require.NoError(t, store.Source().Create(adminCtx, src))

	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	settings.TemplatesURL = "https://example.test/templates.json"
	require.NoError(t, store.Settings().UpdateSettings(settings))

	exportPath := filepath.Join(t.TempDir(), "local-export.json")
	require.NoError(t, store.Export(exportPath))
	info, err := os.Stat(exportPath)
	require.NoError(t, err)
	require.Greater(t, info.Size(), int64(0))

	// Mutate, then import to restore exported values.
	settings.TemplatesURL = "https://changed.test/templates.json"
	require.NoError(t, store.Settings().UpdateSettings(settings))

	ep, err := store.Endpoint().Endpoint(endpointID)
	require.NoError(t, err)
	ep.Name = "changed-name"
	require.NoError(t, store.Endpoint().UpdateEndpoint(endpointID, ep))

	require.NoError(t, store.Import(exportPath))

	settings, err = store.Settings().Settings()
	require.NoError(t, err)
	require.Equal(t, "https://example.test/templates.json", settings.TemplatesURL)

	ep, err = store.Endpoint().Endpoint(endpointID)
	require.NoError(t, err)
	require.Equal(t, "export-local", ep.Name)

	st, err := store.Stack().Read(stackID)
	require.NoError(t, err)
	require.Equal(t, "export-compose", st.Name)

	gotRC, err := store.ResourceControl().Read(rcID)
	require.NoError(t, err)
	require.Equal(t, "vol-xyz", gotRC.ResourceID)

	gotSnap, err := store.Snapshot().Read(endpointID)
	require.NoError(t, err)
	require.Equal(t, 2, gotSnap.Docker.TotalCPU)

	gotTag, err := store.Tag().Read(tagID)
	require.NoError(t, err)
	require.Equal(t, "export-tag", gotTag.Name)

	gotTpl, err := store.CustomTemplate().Read(tplID)
	require.NoError(t, err)
	require.Equal(t, "export-tpl", gotTpl.Title)

	gotRole, err := store.Role().Read(roleID)
	require.NoError(t, err)
	require.Equal(t, "readonly", gotRole.Name)

	gotWF, err := store.Workflow().Read(wfID)
	require.NoError(t, err)
	require.Equal(t, "export-wf", gotWF.Name)

	gotHook, err := store.Webhook().Read(webhookID)
	require.NoError(t, err)
	require.Equal(t, "tok-export", gotHook.Token)

	gotSrc, err := store.Source().Read(adminCtx, src.ID)
	require.NoError(t, err)
	require.Equal(t, "export-src", gotSrc.Name)

	require.Error(t, store.Import(filepath.Join(t.TempDir(), "missing.json")))
}

func TestREQ_SET_01_InitCreatesDefaultSettingsAndUnassignedGroup(t *testing.T) {
	t.Parallel()
	newStore, store := MustNewTestStore(t, false, false)
	require.True(t, newStore)

	require.NoError(t, store.Init())

	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	require.Equal(t, portainer.AuthenticationInternal, settings.AuthenticationMethod)
	require.Equal(t, 12, settings.InternalAuthSettings.RequiredPasswordLength)
	require.Equal(t, portainer.DefaultUserSessionTimeout, settings.UserSessionTimeout)
	require.False(t, settings.IsDockerDesktopExtension)

	ssl, err := store.SSLSettings().Settings()
	require.NoError(t, err)
	require.True(t, ssl.HTTPEnabled)

	groups, err := store.EndpointGroup().ReadAll()
	require.NoError(t, err)
	require.Len(t, groups, 1)
	require.Equal(t, "Unassigned", groups[0].Name)

	// Second Init is a no-op for already-populated defaults.
	require.NoError(t, store.Init())
	groups, err = store.EndpointGroup().ReadAll()
	require.NoError(t, err)
	require.Len(t, groups, 1)
}

func TestREQ_DED_14_InitDefaultPasswordLengthIsTwelve(t *testing.T) {
	t.Parallel()
	_, store := MustNewTestStore(t, false, false)
	require.NoError(t, store.Init())

	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	require.Equal(t, 12, settings.InternalAuthSettings.RequiredPasswordLength)
}

func TestStore_InitFillsEmptyUserSessionTimeout(t *testing.T) {
	t.Parallel()
	_, store := MustNewTestStore(t, true, false)

	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	settings.UserSessionTimeout = ""
	require.NoError(t, store.Settings().UpdateSettings(settings))

	require.NoError(t, store.Init())

	settings, err = store.Settings().Settings()
	require.NoError(t, err)
	require.Equal(t, portainer.DefaultUserSessionTimeout, settings.UserSessionTimeout)
}

func TestStore_InitRespectsDockerExtensionEnv(t *testing.T) {
	t.Setenv("DOCKER_EXTENSION", "1")

	_, store := MustNewTestStore(t, false, false)
	require.NoError(t, store.Init())

	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	require.True(t, settings.IsDockerDesktopExtension)
}

func TestStore_AllowListUpdateAndRead(t *testing.T) {
	t.Parallel()
	_, store := MustNewTestStore(t, true, false)

	list := &portainer.AllowList{
		ID:      portainer.AllowListSSRF,
		Mode:    portainer.SSRFModeEnforce,
		Entries: []string{"example.com", "10.0.0.0/8"},
	}
	require.NoError(t, store.AllowList().Update(portainer.AllowListSSRF, list))

	got, err := store.AllowList().Read(portainer.AllowListSSRF)
	require.NoError(t, err)
	require.Equal(t, portainer.SSRFModeEnforce, got.Mode)
	require.Equal(t, []string{"example.com", "10.0.0.0/8"}, got.Entries)

	err = store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		_, err := tx.AllowList().ReadAll()
		return err
	})
	require.NoError(t, err)
}
