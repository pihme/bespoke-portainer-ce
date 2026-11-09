package migrator

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/database/boltdb"
	"github.com/portainer/portainer/api/database/models"
	"github.com/portainer/portainer/api/dataservices/endpoint"
	"github.com/portainer/portainer/api/dataservices/endpointgroup"
	"github.com/portainer/portainer/api/dataservices/pendingactions"
	"github.com/portainer/portainer/api/dataservices/resourcecontrol"
	"github.com/portainer/portainer/api/dataservices/settings"
	"github.com/portainer/portainer/api/dataservices/stack"
	"github.com/portainer/portainer/api/dataservices/user"
	"github.com/portainer/portainer/api/dataservices/version"
	"github.com/portainer/portainer/api/logs"

	"github.com/stretchr/testify/require"
)

type testServices struct {
	endpointSvc    *endpoint.Service
	endpointGroup  *endpointgroup.Service
	settingsSvc    *settings.Service
	stackSvc       *stack.Service
	userSvc        *user.Service
	versionSvc     *version.Service
	resourceCtrl   *resourcecontrol.Service
	pendingActions *pendingactions.Service
}

func openTestServices(t *testing.T) *testServices {
	t.Helper()
	conn := &boltdb.DbConnection{Path: t.TempDir()}
	require.NoError(t, conn.Open())
	t.Cleanup(func() { logs.CloseAndLogErr(conn) })

	endpointSvc, err := endpoint.NewService(conn)
	require.NoError(t, err)
	endpointGroupSvc, err := endpointgroup.NewService(conn)
	require.NoError(t, err)
	settingsSvc, err := settings.NewService(conn)
	require.NoError(t, err)
	stackSvc, err := stack.NewService(conn)
	require.NoError(t, err)
	userSvc, err := user.NewService(conn)
	require.NoError(t, err)
	versionSvc, err := version.NewService(conn)
	require.NoError(t, err)
	resourceCtrl, err := resourcecontrol.NewService(conn)
	require.NoError(t, err)
	pendingSvc, err := pendingactions.NewService(conn)
	require.NoError(t, err)

	return &testServices{
		endpointSvc:    endpointSvc,
		endpointGroup:  endpointGroupSvc,
		settingsSvc:    settingsSvc,
		stackSvc:       stackSvc,
		userSvc:        userSvc,
		versionSvc:     versionSvc,
		resourceCtrl:   resourceCtrl,
		pendingActions: pendingSvc,
	}
}

func (s *testServices) newMigrator(current *models.Version) *Migrator {
	v := current
	if v == nil {
		v = &models.Version{SchemaVersion: "1.0.0", Edition: int(portainer.PortainerCE)}
	}
	return NewMigrator(&MigratorParameters{
		CurrentDBVersion:       v,
		EndpointService:        s.endpointSvc,
		EndpointGroupService:   s.endpointGroup,
		SettingsService:        s.settingsSvc,
		StackService:           s.stackSvc,
		UserService:            s.userSvc,
		VersionService:         s.versionSvc,
		ResourceControlService: s.resourceCtrl,
		PendingActionsService:  s.pendingActions,
	})
}

func seedSettings(t *testing.T, svc *settings.Service, s *portainer.Settings) {
	t.Helper()
	require.NoError(t, svc.UpdateSettings(s))
}
