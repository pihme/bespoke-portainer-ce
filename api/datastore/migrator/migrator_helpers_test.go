package migrator

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/database/boltdb"
	"github.com/portainer/portainer/api/database/models"
	"github.com/portainer/portainer/api/dataservices/endpoint"
	"github.com/portainer/portainer/api/dataservices/endpointgroup"
	"github.com/portainer/portainer/api/dataservices/endpointrelation"
	"github.com/portainer/portainer/api/dataservices/pendingactions"
	"github.com/portainer/portainer/api/dataservices/resourcecontrol"
	"github.com/portainer/portainer/api/dataservices/role"
	"github.com/portainer/portainer/api/dataservices/schedule"
	"github.com/portainer/portainer/api/dataservices/settings"
	"github.com/portainer/portainer/api/dataservices/stack"
	"github.com/portainer/portainer/api/dataservices/tag"
	"github.com/portainer/portainer/api/dataservices/tunnelserver"
	"github.com/portainer/portainer/api/dataservices/user"
	"github.com/portainer/portainer/api/dataservices/version"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/internal/authorization"
	"github.com/portainer/portainer/api/logs"

	"github.com/stretchr/testify/require"
)

type testServices struct {
	conn           *boltdb.DbConnection
	endpointSvc    *endpoint.Service
	endpointGroup  *endpointgroup.Service
	endpointRel    *endpointrelation.Service
	settingsSvc    *settings.Service
	stackSvc       *stack.Service
	userSvc        *user.Service
	versionSvc     *version.Service
	resourceCtrl   *resourcecontrol.Service
	pendingActions *pendingactions.Service
	tagSvc         *tag.Service
	scheduleSvc    *schedule.Service
	roleSvc        *role.Service
	tunnelSvc      *tunnelserver.Service
	fileSvc        *filesystem.Service
	authSvc        *authorization.Service
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
	endpointRel, err := endpointrelation.NewService(conn)
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
	tagSvc, err := tag.NewService(conn)
	require.NoError(t, err)
	scheduleSvc, err := schedule.NewService(conn)
	require.NoError(t, err)
	roleSvc, err := role.NewService(conn)
	require.NoError(t, err)
	tunnelSvc, err := tunnelserver.NewService(conn)
	require.NoError(t, err)

	fileRoot := t.TempDir()
	fileSvc, err := filesystem.NewService(fileRoot, fileRoot)
	require.NoError(t, err)

	return &testServices{
		conn:           conn,
		endpointSvc:    endpointSvc,
		endpointGroup:  endpointGroupSvc,
		endpointRel:    endpointRel,
		settingsSvc:    settingsSvc,
		stackSvc:       stackSvc,
		userSvc:        userSvc,
		versionSvc:     versionSvc,
		resourceCtrl:   resourceCtrl,
		pendingActions: pendingSvc,
		tagSvc:         tagSvc,
		scheduleSvc:    scheduleSvc,
		roleSvc:        roleSvc,
		tunnelSvc:      tunnelSvc,
		fileSvc:        fileSvc,
		authSvc:        authorization.NewService(nil),
	}
}

func (s *testServices) newMigrator(current *models.Version) *Migrator {
	v := current
	if v == nil {
		v = &models.Version{SchemaVersion: "1.0.0", Edition: int(portainer.PortainerCE)}
	}
	return NewMigrator(&MigratorParameters{
		CurrentDBVersion:        v,
		EndpointService:         s.endpointSvc,
		EndpointGroupService:    s.endpointGroup,
		EndpointRelationService: s.endpointRel,
		SettingsService:         s.settingsSvc,
		StackService:            s.stackSvc,
		UserService:             s.userSvc,
		VersionService:          s.versionSvc,
		ResourceControlService:  s.resourceCtrl,
		PendingActionsService:   s.pendingActions,
		TagService:              s.tagSvc,
		ScheduleService:         s.scheduleSvc,
		RoleService:             s.roleSvc,
		TunnelServerService:     s.tunnelSvc,
		FileService:             s.fileSvc,
		AuthorizationService:    s.authSvc,
	})
}

func seedSettings(t *testing.T, svc *settings.Service, s *portainer.Settings) {
	t.Helper()
	require.NoError(t, svc.UpdateSettings(s))
}

func seedRoles1to4(t *testing.T, svc *role.Service) {
	t.Helper()
	for _, name := range []string{"endpoint-admin", "helpdesk", "standard", "readonly"} {
		require.NoError(t, svc.Create(&portainer.Role{Name: name}))
	}
}
