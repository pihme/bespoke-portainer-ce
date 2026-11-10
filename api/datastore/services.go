package datastore

import (
	"fmt"
	"os"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/database/models"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/customtemplate"
	"github.com/portainer/portainer/api/dataservices/edgestack"
	"github.com/portainer/portainer/api/dataservices/endpoint"
	"github.com/portainer/portainer/api/dataservices/endpointgroup"
	"github.com/portainer/portainer/api/dataservices/pendingactions"
	"github.com/portainer/portainer/api/dataservices/registry"
	"github.com/portainer/portainer/api/dataservices/resourcecontrol"
	"github.com/portainer/portainer/api/dataservices/settings"
	"github.com/portainer/portainer/api/dataservices/snapshot"
	"github.com/portainer/portainer/api/dataservices/source"
	"github.com/portainer/portainer/api/dataservices/ssl"
	"github.com/portainer/portainer/api/dataservices/stack"
	"github.com/portainer/portainer/api/dataservices/tag"
	"github.com/portainer/portainer/api/dataservices/team"
	"github.com/portainer/portainer/api/dataservices/teammembership"
	"github.com/portainer/portainer/api/dataservices/user"
	"github.com/portainer/portainer/api/dataservices/version"
	"github.com/portainer/portainer/api/dataservices/webhook"
	"github.com/portainer/portainer/api/dataservices/workflow"

	"github.com/rs/zerolog/log"
	"github.com/segmentio/encoding/json"
)

var _ dataservices.DataStore = &Store{}

// Store defines the implementation of portainer.DataStore using
// BoltDB as the storage system.
type Store struct {
	flags      *portainer.CLIFlags
	connection portainer.Connection

	fileService            portainer.FileService
	CustomTemplateService  *customtemplate.Service
	EdgeStackService       *edgestack.Service
	EndpointGroupService   *endpointgroup.Service
	EndpointService        *endpoint.Service
	RegistryService        *registry.Service
	ResourceControlService *resourcecontrol.Service
	SettingsService        *settings.Service
	SnapshotService        *snapshot.Service
	SourceService          *source.Service
	SSLSettingsService     *ssl.Service
	StackService           *stack.Service
	TagService             *tag.Service
	TeamMembershipService  *teammembership.Service
	TeamService            *team.Service
	UserService            *user.Service
	VersionService         *version.Service
	WebhookService         *webhook.Service
	WorkflowService        *workflow.Service
	PendingActionsService  *pendingactions.Service
}

func (store *Store) initServices() error {
	customTemplateService, err := customtemplate.NewService(store.connection)
	if err != nil {
		return err
	}
	store.CustomTemplateService = customTemplateService

	edgeStackService, err := edgestack.NewService(store.connection, nil)
	if err != nil {
		return err
	}
	store.EdgeStackService = edgeStackService

	endpointgroupService, err := endpointgroup.NewService(store.connection)
	if err != nil {
		return err
	}
	store.EndpointGroupService = endpointgroupService

	endpointService, err := endpoint.NewService(store.connection)
	if err != nil {
		return err
	}
	store.EndpointService = endpointService

	registryService, err := registry.NewService(store.connection)
	if err != nil {
		return err
	}
	store.RegistryService = registryService

	resourcecontrolService, err := resourcecontrol.NewService(store.connection)
	if err != nil {
		return err
	}
	store.ResourceControlService = resourcecontrolService

	settingsService, err := settings.NewService(store.connection)
	if err != nil {
		return err
	}
	store.SettingsService = settingsService

	snapshotService, err := snapshot.NewService(store.connection)
	if err != nil {
		return err
	}
	store.SnapshotService = snapshotService

	sourceService, err := source.NewService(store.connection)
	if err != nil {
		return err
	}
	store.SourceService = sourceService

	sslSettingsService, err := ssl.NewService(store.connection)
	if err != nil {
		return err
	}
	store.SSLSettingsService = sslSettingsService

	stackService, err := stack.NewService(store.connection)
	if err != nil {
		return err
	}
	store.StackService = stackService

	tagService, err := tag.NewService(store.connection)
	if err != nil {
		return err
	}
	store.TagService = tagService

	teammembershipService, err := teammembership.NewService(store.connection)
	if err != nil {
		return err
	}
	store.TeamMembershipService = teammembershipService

	teamService, err := team.NewService(store.connection)
	if err != nil {
		return err
	}
	store.TeamService = teamService

	userService, err := user.NewService(store.connection)
	if err != nil {
		return err
	}
	store.UserService = userService

	versionService, err := version.NewService(store.connection)
	if err != nil {
		return err
	}
	store.VersionService = versionService

	webhookService, err := webhook.NewService(store.connection)
	if err != nil {
		return err
	}
	store.WebhookService = webhookService

	workflowService, err := workflow.NewService(store.connection)
	if err != nil {
		return err
	}
	store.WorkflowService = workflowService

	pendingActionsService, err := pendingactions.NewService(store.connection)
	if err != nil {
		return err
	}
	store.PendingActionsService = pendingActionsService

	return nil
}

// PendingActions gives access to the PendingActions data management layer
func (store *Store) PendingActions() dataservices.PendingActionsService {
	return store.PendingActionsService
}

// CustomTemplate gives access to the CustomTemplate data management layer
func (store *Store) CustomTemplate() dataservices.CustomTemplateService {
	return store.CustomTemplateService
}

// EdgeStack gives access to the EdgeStack data management layer
func (store *Store) EdgeStack() dataservices.EdgeStackService {
	return store.EdgeStackService
}

// Environment(Endpoint) gives access to the Environment(Endpoint) data management layer
func (store *Store) Endpoint() dataservices.EndpointService {
	return store.EndpointService
}

// EndpointGroup gives access to the EndpointGroup data management layer
func (store *Store) EndpointGroup() dataservices.EndpointGroupService {
	return store.EndpointGroupService
}

// Registry gives access to the Registry data management layer
func (store *Store) Registry() dataservices.RegistryService {
	return store.RegistryService
}

// ResourceControl gives access to the ResourceControl data management layer
func (store *Store) ResourceControl() dataservices.ResourceControlService {
	return store.ResourceControlService
}

// Settings gives access to the Settings data management layer
func (store *Store) Settings() dataservices.SettingsService {
	return store.SettingsService
}

func (store *Store) Snapshot() dataservices.SnapshotService {
	return store.SnapshotService
}

// Source gives access to the Source data management layer
func (store *Store) Source() dataservices.SourceService {
	return store.SourceService
}

// SSLSettings gives access to the SSL Settings data management layer
func (store *Store) SSLSettings() dataservices.SSLSettingsService {
	return store.SSLSettingsService
}

// Stack gives access to the Stack data management layer
func (store *Store) Stack() dataservices.StackService {
	return store.StackService
}

// Tag gives access to the Tag data management layer
func (store *Store) Tag() dataservices.TagService {
	return store.TagService
}

// TeamMembership gives access to the TeamMembership data management layer
func (store *Store) TeamMembership() dataservices.TeamMembershipService {
	return store.TeamMembershipService
}

// Team gives access to the Team data management layer
func (store *Store) Team() dataservices.TeamService {
	return store.TeamService
}

// User gives access to the User data management layer
func (store *Store) User() dataservices.UserService {
	return store.UserService
}

// Version gives access to the Version data management layer
func (store *Store) Version() dataservices.VersionService {
	return store.VersionService
}

// Webhook gives access to the Webhook data management layer
func (store *Store) Webhook() dataservices.WebhookService {
	return store.WebhookService
}

// Workflow gives access to the Workflow data management layer
func (store *Store) Workflow() dataservices.WorkflowService {
	return store.WorkflowService
}

type storeExport struct {
	CustomTemplate  []portainer.CustomTemplate  `json:"customtemplates,omitempty"`
	EdgeStack       []portainer.EdgeStack       `json:"edge_stack,omitempty"`
	Endpoint        []portainer.Endpoint        `json:"endpoints,omitempty"`
	EndpointGroup   []portainer.EndpointGroup   `json:"endpoint_groups,omitempty"`
	Registry        []portainer.Registry        `json:"registries,omitempty"`
	ResourceControl []portainer.ResourceControl `json:"resource_control,omitempty"`
	Settings        portainer.Settings          `json:"settings,omitzero"`
	Snapshot        []portainer.Snapshot        `json:"snapshots,omitempty"`
	SSLSettings     portainer.SSLSettings       `json:"ssl,omitzero"`
	Source          []portainer.Source          `json:"sources,omitempty"`
	Stack           []portainer.Stack           `json:"stacks,omitempty"`
	Tag             []portainer.Tag             `json:"tags,omitempty"`
	TeamMembership  []portainer.TeamMembership  `json:"team_membership,omitempty"`
	Team            []portainer.Team            `json:"teams,omitempty"`
	User            []portainer.User            `json:"users,omitempty"`
	Version         models.Version              `json:"version,omitzero"`
	Webhook         []portainer.Webhook         `json:"webhooks,omitempty"`
	Workflow        []portainer.Workflow        `json:"workflows,omitempty"`
	Metadata        map[string]any              `json:"metadata,omitempty"`
}

func (store *Store) Export(filename string) (err error) {
	backup := storeExport{}

	if c, err := store.CustomTemplate().ReadAll(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Custom Templates")
		}
	} else {
		backup.CustomTemplate = c
	}

	if e, err := store.EdgeStack().EdgeStacks(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Edge Stacks")
		}
	} else {
		backup.EdgeStack = e
	}

	if e, err := store.Endpoint().Endpoints(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Endpoints")
		}
	} else {
		backup.Endpoint = e
	}

	if e, err := store.EndpointGroup().ReadAll(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Endpoint Groups")
		}
	} else {
		backup.EndpointGroup = e
	}

	if r, err := store.Registry().ReadAll(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Registries")
		}
	} else {
		backup.Registry = r
	}

	if c, err := store.ResourceControl().ReadAll(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Resource Controls")
		}
	} else {
		backup.ResourceControl = c
	}

	if settings, err := store.Settings().Settings(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Settings")
		}
	} else {
		backup.Settings = *settings
	}

	if snapshot, err := store.Snapshot().ReadAll(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Snapshots")
		}
	} else {
		backup.Snapshot = snapshot
	}

	if settings, err := store.SSLSettings().Settings(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting SSL Settings")
		}
	} else {
		backup.SSLSettings = *settings
	}

	if s, err := store.Source().ReadAll(source.InsecureNewAdminContext()); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Sources")
		}
	} else {
		backup.Source = s
	}

	if t, err := store.Stack().ReadAll(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Stacks")
		}
	} else {
		backup.Stack = t
	}

	if t, err := store.Tag().ReadAll(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Tags")
		}
	} else {
		backup.Tag = t
	}

	if t, err := store.TeamMembership().ReadAll(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Team Memberships")
		}
	} else {
		backup.TeamMembership = t
	}

	if t, err := store.Team().ReadAll(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Teams")
		}
	} else {
		backup.Team = t
	}

	if users, err := store.User().ReadAll(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Users")
		}
	} else {
		backup.User = users
	}

	if webhooks, err := store.Webhook().ReadAll(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Webhooks")
		}
	} else {
		backup.Webhook = webhooks
	}

	if w, err := store.Workflow().ReadAll(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Workflows")
		}
	} else {
		backup.Workflow = w
	}

	if version, err := store.Version().Version(); err != nil {
		if !store.IsErrObjectNotFound(err) {
			log.Error().Err(err).Msg("exporting Version")
		}
	} else {
		backup.Version = *version
	}

	backup.Metadata, err = store.connection.BackupMetadata()
	if err != nil {
		log.Error().Err(err).Msg("exporting Metadata")
	}

	b, err := json.MarshalIndent(backup, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filename, b, 0o600)
}

func (store *Store) Import(filename string) (err error) {
	backup := storeExport{}

	s, err := os.ReadFile(filename)
	if err != nil {
		return err
	}
	err = json.Unmarshal(s, &backup)
	if err != nil {
		return err
	}

	err = store.Version().UpdateVersion(&backup.Version)
	if err != nil {
		return err
	}

	for _, v := range backup.CustomTemplate {
		if err := store.CustomTemplate().Update(v.ID, &v); err != nil {
			log.Warn().Err(err).Msg("failed to update the custom template in the database")
		}
	}

	for _, v := range backup.EdgeStack {
		if err := store.EdgeStack().UpdateEdgeStack(v.ID, &v); err != nil {
			log.Warn().Err(err).Msg("failed to update the edge stack in the database")
		}
	}

	for _, v := range backup.Endpoint {
		if err := store.Endpoint().UpdateEndpoint(v.ID, &v); err != nil {
			log.Warn().Err(err).Msg("failed to update the endpoint in the database")
		}
	}

	for _, v := range backup.EndpointGroup {
		if err := store.EndpointGroup().Update(v.ID, &v); err != nil {
			log.Warn().Err(err).Msg("failed to update the endpoint group in the database")
		}
	}

	for _, v := range backup.Registry {
		if err := store.Registry().Update(v.ID, &v); err != nil {
			log.Warn().Err(err).Msg("failed to update the registry in the database")
		}
	}

	for _, v := range backup.ResourceControl {
		if err := store.ResourceControl().Update(v.ID, &v); err != nil {
			log.Warn().Err(err).Msg("failed to update the resource control in the database")
		}
	}

	if err := store.Settings().UpdateSettings(&backup.Settings); err != nil {
		log.Warn().Err(err).Msg("failed to update the settings in the database")
	}

	if err := store.SSLSettings().UpdateSettings(&backup.SSLSettings); err != nil {
		log.Warn().Err(err).Msg("failed to update the SSL settings in the database")
	}

	for _, v := range backup.Snapshot {
		if err := store.Snapshot().Update(v.EndpointID, &v); err != nil {
			log.Warn().Err(err).Msg("failed to update the snapshot in the database")
		}
	}

	for _, v := range backup.Source {
		if err := store.Source().Update(source.InsecureNewAdminContext(), v.ID, &v); err != nil {
			log.Warn().Err(err).Msg("failed to update the source in the database")
		}
	}

	for _, v := range backup.Workflow {
		if err := store.Workflow().Update(v.ID, &v); err != nil {
			log.Warn().Err(err).Msg("failed to update the workflow in the database")
		}
	}

	for _, v := range backup.Stack {
		if err := store.Stack().Update(v.ID, &v); err != nil {
			log.Warn().Err(err).Msg("failed to update the stack in the database")
		}
	}

	for _, v := range backup.Tag {
		if err := store.Tag().Update(v.ID, &v); err != nil {
			log.Warn().Err(err).Msg("failed to update the tag in the database")
		}
	}

	for _, v := range backup.TeamMembership {
		if err := store.TeamMembership().Update(v.ID, &v); err != nil {
			log.Warn().Err(err).Msg("failed to update the team membership in the database")
		}
	}

	for _, v := range backup.Team {
		if err := store.Team().Update(v.ID, &v); err != nil {
			log.Warn().Err(err).Msg("failed to update the team in the database")
		}
	}

	for _, user := range backup.User {
		if err := store.User().Update(user.ID, &user); err != nil {
			log.Warn().Str("user", fmt.Sprintf("%+v", user)).Err(err).Msg("failed to update the user in the database")
		}
	}

	for _, v := range backup.Webhook {
		if err := store.Webhook().Update(v.ID, &v); err != nil {
			log.Warn().Err(err).Msg("failed to update the webhook in the database")
		}
	}

	return store.connection.RestoreMetadata(backup.Metadata)
}
