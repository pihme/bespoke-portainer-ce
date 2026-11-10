package testhelpers

import (
	"io"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/database"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/errors"
	"github.com/portainer/portainer/api/slicesx"
)

var _ dataservices.DataStore = &testDatastore{}

type testDatastore struct {
	customTemplate  dataservices.CustomTemplateService
	endpoint        dataservices.EndpointService
	endpointGroup   dataservices.EndpointGroupService
	registry        dataservices.RegistryService
	resourceControl dataservices.ResourceControlService
	source          dataservices.SourceService
	sslSettings     dataservices.SSLSettingsService
	settings        dataservices.SettingsService
	snapshot        dataservices.SnapshotService
	stack           dataservices.StackService
	teamMembership  dataservices.TeamMembershipService
	team            dataservices.TeamService
	user            dataservices.UserService
	version         dataservices.VersionService
	workflow        dataservices.WorkflowService
	connection      portainer.Connection
}

func (d *testDatastore) Backup(path string) (string, error)                  { return "", nil }
func (d *testDatastore) BackupTo(w io.Writer) error                          { return nil }
func (d *testDatastore) Open() (bool, error)                                 { return false, nil }
func (d *testDatastore) Init() error                                         { return nil }
func (d *testDatastore) Close() error                                        { return nil }
func (d *testDatastore) UpdateTx(func(dataservices.DataStoreTx) error) error { return nil }
func (d *testDatastore) ViewTx(func(dataservices.DataStoreTx) error) error   { return nil }

func (d *testDatastore) CheckCurrentEdition() error                         { return nil }
func (d *testDatastore) MigrateData() error                                 { return nil }
func (d *testDatastore) Rollback(force bool) error                          { return nil }
func (d *testDatastore) CustomTemplate() dataservices.CustomTemplateService { return d.customTemplate }
func (d *testDatastore) Endpoint() dataservices.EndpointService             { return d.endpoint }
func (d *testDatastore) EndpointGroup() dataservices.EndpointGroupService   { return d.endpointGroup }

func (d *testDatastore) Registry() dataservices.RegistryService { return d.registry }
func (d *testDatastore) ResourceControl() dataservices.ResourceControlService {
	return d.resourceControl
}
func (d *testDatastore) Source() dataservices.SourceService                 { return d.source }
func (d *testDatastore) Settings() dataservices.SettingsService             { return d.settings }
func (d *testDatastore) Snapshot() dataservices.SnapshotService             { return d.snapshot }
func (d *testDatastore) SSLSettings() dataservices.SSLSettingsService       { return d.sslSettings }
func (d *testDatastore) Stack() dataservices.StackService                   { return d.stack }
func (d *testDatastore) TeamMembership() dataservices.TeamMembershipService { return d.teamMembership }
func (d *testDatastore) Team() dataservices.TeamService                     { return d.team }
func (d *testDatastore) User() dataservices.UserService                     { return d.user }
func (d *testDatastore) Version() dataservices.VersionService               { return d.version }
func (d *testDatastore) Workflow() dataservices.WorkflowService             { return d.workflow }

func (d *testDatastore) Connection() portainer.Connection {
	return d.connection
}

func (d *testDatastore) IsErrObjectNotFound(e error) bool {
	return false
}

func (d *testDatastore) Export(filename string) (err error) {
	return nil
}

func (d *testDatastore) Import(filename string) (err error) {
	return nil
}

type datastoreOption = func(d *testDatastore)

// NewDatastore creates new instance of testDatastore.
// Will apply options before returning, opts will be applied from left to right.
func NewDatastore(options ...datastoreOption) *testDatastore {
	conn, _ := database.NewDatabase("boltdb", "", nil, false)
	d := testDatastore{connection: conn}

	for _, o := range options {
		o(&d)
	}

	return &d
}

type stubSettingsService struct {
	settings *portainer.Settings
}

func (s *stubSettingsService) BucketName() string { return "settings" }

func (s *stubSettingsService) Settings() (*portainer.Settings, error) {
	return s.settings, nil
}

func (s *stubSettingsService) UpdateSettings(settings *portainer.Settings) error {
	s.settings = settings

	return nil
}

func WithSettingsService(settings *portainer.Settings) datastoreOption {
	return func(d *testDatastore) {
		d.settings = &stubSettingsService{
			settings: settings,
		}
	}
}

type stubSSLSettingsService struct {
	settings *portainer.SSLSettings
}

func (s *stubSSLSettingsService) BucketName() string { return "ssl" }

func (s *stubSSLSettingsService) Settings() (*portainer.SSLSettings, error) {
	return s.settings, nil
}

func (s *stubSSLSettingsService) UpdateSettings(settings *portainer.SSLSettings) error {
	s.settings = settings
	return nil
}

func WithSSLSettingsService(settings *portainer.SSLSettings) datastoreOption {
	return func(d *testDatastore) {
		d.sslSettings = &stubSSLSettingsService{settings: settings}
	}
}

type stubUserService struct {
	dataservices.UserService

	users []portainer.User
}

func (s *stubUserService) BucketName() string { return "users" }
func (s *stubUserService) ReadAll(predicates ...func(portainer.User) bool) ([]portainer.User, error) {
	filtered := s.users

	for _, p := range predicates {
		filtered = slicesx.Filter(filtered, p)
	}

	return filtered, nil
}

func (s *stubUserService) UsersByRole(role portainer.UserRole) ([]portainer.User, error) {
	return s.users, nil
}

// WithUsers testDatastore option that will instruct testDatastore to return provided users
func WithUsers(us []portainer.User) datastoreOption {
	return func(d *testDatastore) {
		d.user = &stubUserService{users: us}
	}
}

type stubEndpointService struct {
	dataservices.EndpointService

	endpoints []portainer.Endpoint
}

func (s *stubEndpointService) BucketName() string { return "endpoint" }
func (s *stubEndpointService) Endpoint(ID portainer.EndpointID) (*portainer.Endpoint, error) {
	for _, endpoint := range s.endpoints {
		if endpoint.ID == ID {
			return &endpoint, nil
		}
	}

	return nil, errors.ErrObjectNotFound
}

func (s *stubEndpointService) EndpointIDByEdgeID(edgeID string) (portainer.EndpointID, bool) {
	for _, endpoint := range s.endpoints {
		if endpoint.EdgeID == edgeID {
			return endpoint.ID, true
		}
	}

	return 0, false
}

func (s *stubEndpointService) Heartbeat(endpointID portainer.EndpointID) (int64, bool) {
	for i, endpoint := range s.endpoints {
		if endpoint.ID == endpointID {
			return s.endpoints[i].LastCheckInDate, true
		}
	}

	return 0, false
}

func (s *stubEndpointService) UpdateHeartbeat(endpointID portainer.EndpointID) {
	for i, endpoint := range s.endpoints {
		if endpoint.ID == endpointID {
			s.endpoints[i].LastCheckInDate = time.Now().Unix()
		}
	}
}

func (s *stubEndpointService) Endpoints() ([]portainer.Endpoint, error) {
	return s.endpoints, nil
}

func (s *stubEndpointService) Create(endpoint *portainer.Endpoint) error {
	s.endpoints = append(s.endpoints, *endpoint)

	return nil
}

func (s *stubEndpointService) UpdateEndpoint(ID portainer.EndpointID, endpoint *portainer.Endpoint) error {
	for i, e := range s.endpoints {
		if e.ID == ID {
			s.endpoints[i] = *endpoint
		}
	}

	return nil
}

func (s *stubEndpointService) DeleteEndpoint(ID portainer.EndpointID) error {
	endpoints := []portainer.Endpoint{}

	for _, endpoint := range s.endpoints {
		if endpoint.ID != ID {
			endpoints = append(endpoints, endpoint)
		}
	}

	s.endpoints = endpoints

	return nil
}

func (s *stubEndpointService) GetNextIdentifier() int {
	return len(s.endpoints)
}

func (s *stubEndpointService) EndpointsByTeamID(teamID portainer.TeamID) ([]portainer.Endpoint, error) {
	endpoints := make([]portainer.Endpoint, 0)

	for _, e := range s.endpoints {
		for t := range e.TeamAccessPolicies {
			if t == teamID {
				endpoints = append(endpoints, e)
			}
		}
	}

	return endpoints, nil
}

// WithEndpoints option will instruct testDatastore to return provided environments(endpoints)
func WithEndpoints(endpoints []portainer.Endpoint) datastoreOption {
	return func(d *testDatastore) {
		d.endpoint = &stubEndpointService{endpoints: endpoints}
	}
}

type stubStacksService struct {
	dataservices.StackService
	stacks []portainer.Stack
}

func (s *stubStacksService) BucketName() string { return "stacks" }

func (s *stubStacksService) Read(ID portainer.StackID) (*portainer.Stack, error) {
	for _, stack := range s.stacks {
		if stack.ID == ID {
			return &stack, nil
		}
	}

	return nil, errors.ErrObjectNotFound
}

func (s *stubStacksService) ReadAll(predicates ...func(portainer.Stack) bool) ([]portainer.Stack, error) {
	filtered := s.stacks

	for _, p := range predicates {
		filtered = slicesx.Filter(filtered, p)
	}

	return filtered, nil
}

func (s *stubStacksService) StacksByEndpointID(endpointID portainer.EndpointID) ([]portainer.Stack, error) {
	result := make([]portainer.Stack, 0)

	for _, stack := range s.stacks {
		if stack.EndpointID == endpointID {
			result = append(result, stack)
		}
	}

	return result, nil
}

func (s *stubStacksService) StackByName(name string) (*portainer.Stack, error) {
	for _, stack := range s.stacks {
		if stack.Name == name {
			return &stack, nil
		}
	}

	return nil, errors.ErrObjectNotFound
}

func (s *stubStacksService) StacksByName(name string) ([]portainer.Stack, error) {
	result := make([]portainer.Stack, 0)

	for _, stack := range s.stacks {
		if stack.Name == name {
			result = append(result, stack)
		}
	}

	return result, nil
}

func (s *stubStacksService) StackByWebhookID(webhookID string) (*portainer.Stack, error) {
	for _, stack := range s.stacks {
		if stack.AutoUpdate != nil && stack.AutoUpdate.Webhook == webhookID {
			return &stack, nil
		}
	}

	return nil, errors.ErrObjectNotFound
}

func (s *stubStacksService) GetNextIdentifier() int {
	return len(s.stacks)
}

func (s *stubStacksService) Exists(ID portainer.StackID) (bool, error) {
	return false, nil
}

// WithStacks option will instruct testDatastore to return provided stacks
func WithStacks(stacks []portainer.Stack) datastoreOption {
	return func(d *testDatastore) {
		d.stack = &stubStacksService{stacks: stacks}
	}
}
