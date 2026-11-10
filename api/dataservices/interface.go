package dataservices

import (
	"io"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/database/models"
)

type (
	DataStoreTx interface {
		IsErrObjectNotFound(err error) bool
		CustomTemplate() CustomTemplateService
		Endpoint() EndpointService
		EndpointGroup() EndpointGroupService
		ResourceControl() ResourceControlService
		Settings() SettingsService
		Snapshot() SnapshotService
		SSLSettings() SSLSettingsService
		Source() SourceService
		Stack() StackService
		User() UserService
		Version() VersionService
		Workflow() WorkflowService
	}

	DataStore interface {
		Open() (newStore bool, err error)
		Init() error
		Close() error
		UpdateTx(func(tx DataStoreTx) error) error
		ViewTx(func(tx DataStoreTx) error) error
		MigrateData() error
		Rollback(force bool) error
		CheckCurrentEdition() error
		Backup(path string) (string, error)
		BackupTo(w io.Writer) error
		Export(filename string) (err error)

		DataStoreTx
	}

	// CustomTemplateService represents a service to manage custom templates
	CustomTemplateService interface {
		BaseCRUD[portainer.CustomTemplate, portainer.CustomTemplateID]
		GetNextIdentifier() int
	}

	// EndpointService represents a service for managing environment(endpoint) data
	EndpointService interface {
		// partial dataservices.BaseCRUD[portainer.Endpoint, portainer.EndpointID]
		ReadAll(predicates ...func(endpoint portainer.Endpoint) bool) ([]portainer.Endpoint, error)

		Endpoint(ID portainer.EndpointID) (*portainer.Endpoint, error)
		Heartbeat(endpointID portainer.EndpointID) (int64, bool)
		Endpoints() ([]portainer.Endpoint, error)
		Create(endpoint *portainer.Endpoint) error
		UpdateEndpoint(ID portainer.EndpointID, endpoint *portainer.Endpoint) error
		DeleteEndpoint(ID portainer.EndpointID) error
		GetNextIdentifier() int
	}

	// EndpointGroupService represents a service for managing environment(endpoint) group data
	EndpointGroupService interface {
		BaseCRUD[portainer.EndpointGroup, portainer.EndpointGroupID]
	}

	// ResourceControlService represents a service for managing resource control data
	ResourceControlService interface {
		BaseCRUD[portainer.ResourceControl, portainer.ResourceControlID]
		ResourceControlByResourceIDAndType(resourceID string, resourceType portainer.ResourceControlType) (*portainer.ResourceControl, error)
	}

	// SettingsService represents a service for managing application settings
	SettingsService interface {
		Settings() (*portainer.Settings, error)
		UpdateSettings(settings *portainer.Settings) error
	}

	SnapshotService interface {
		BaseCRUD[portainer.Snapshot, portainer.EndpointID]
		ReadWithoutSnapshotRaw(ID portainer.EndpointID) (*portainer.Snapshot, error)
	}

	// SSLSettingsService represents a service for managing application settings
	SSLSettingsService interface {
		Settings() (*portainer.SSLSettings, error)
		UpdateSettings(settings *portainer.SSLSettings) error
	}

	SourceServiceUserContext interface {
		ID() portainer.UserID
		TeamMemberships() []portainer.TeamMembership
		IsAdmin() bool
	}

	// SourceService represents a service for managing GitOps source data
	SourceService interface {
		Create(context SourceServiceUserContext, source *portainer.Source) error
		Read(context SourceServiceUserContext, ID portainer.SourceID) (*portainer.Source, error)
		Exists(context SourceServiceUserContext, ID portainer.SourceID) (bool, error)
		ReadAll(context SourceServiceUserContext, predicates ...func(portainer.Source) bool) ([]portainer.Source, error)
		Update(context SourceServiceUserContext, ID portainer.SourceID, source *portainer.Source) error
		UpdateSyncStatus(context SourceServiceUserContext, ID portainer.SourceID, status portainer.SourceStatus, statusError string) error
		Delete(context SourceServiceUserContext, ID portainer.SourceID) error
		FindOrCreateGitSource(context SourceServiceUserContext, source *portainer.Source) (*portainer.Source, error)
	}

	// StackService represents a service for managing stack data
	StackService interface {
		BaseCRUD[portainer.Stack, portainer.StackID]
		StackByName(name string) (*portainer.Stack, error)
		StacksByName(name string) ([]portainer.Stack, error)
		GetNextIdentifier() int
		StackByWebhookID(ID string) (*portainer.Stack, error)
	}

	// UserService represents a service for managing user data
	UserService interface {
		BaseCRUD[portainer.User, portainer.UserID]
		UserByUsername(username string) (*portainer.User, error)
		UserIDByUsername(username string) (portainer.UserID, error)
		UsersByRole(role portainer.UserRole) ([]portainer.User, error)
	}

	// VersionService represents a service for managing version data
	VersionService interface {
		InstanceID() (string, error)
		Edition() (portainer.SoftwareEdition, error)
		Version() (*models.Version, error)
		UpdateVersion(*models.Version) error
	}

	// WorkflowService represents a service for managing GitOps workflow data
	WorkflowService interface {
		BaseCRUD[portainer.Workflow, portainer.WorkflowID]
	}
)
