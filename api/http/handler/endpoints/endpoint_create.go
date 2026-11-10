package endpoints

import (
	"errors"
	"net/http"
	"runtime"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/http/client"
	"github.com/portainer/portainer/api/internal/snapshot"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"
	"github.com/portainer/portainer/pkg/libhttp/request"
	"github.com/portainer/portainer/pkg/libhttp/response"
)

type endpointCreatePayload struct {
	Name                   string
	URL                    string
	EndpointCreationType   endpointCreationEnum
	PublicURL              string
	Gpus                   []portainer.Pair
	GroupID                int
	AzureApplicationID     string
	AzureTenantID          string
	AzureAuthenticationKey string
	TagIDs                 []portainer.TagID
	ContainerEngine        string
}

type endpointCreationEnum int

const (
	_ endpointCreationEnum = iota
	localDockerEnvironment
	_ // 2 was the Agent environment, removed with the Portainer Agent (TAI-007).
	azureEnvironment
	// 4 was the Edge Agent environment, removed with Edge (TAI-004).
	// 5 was the local Kubernetes environment, removed with Kubernetes (TAI-002).
)

func (payload *endpointCreatePayload) Validate(r *http.Request) error {
	name, err := request.RetrieveMultiPartFormValue(r, "Name", false)
	if err != nil {
		return errors.New("invalid environment name")
	}
	payload.Name = name

	endpointCreationType, err := request.RetrieveNumericMultiPartFormValue(r, "EndpointCreationType", false)
	if err == nil && endpointCreationType == 4 {
		return errors.New("Edge Agent environments are no longer supported")
	}

	if err == nil && endpointCreationType == 2 {
		return portainer.ErrAgentEnvironmentNotSupported
	}

	if err != nil || endpointCreationType < int(localDockerEnvironment) || endpointCreationType > int(azureEnvironment) {
		return errors.New("invalid environment type value. Value must be one of: 1 (Docker environment) or 3 (Azure environment)")
	}
	payload.EndpointCreationType = endpointCreationEnum(endpointCreationType)

	payload.ContainerEngine, err = request.RetrieveMultiPartFormValue(r, "ContainerEngine", true)
	if err != nil || (payload.ContainerEngine != "" && payload.ContainerEngine != portainer.ContainerEngineDocker && payload.ContainerEngine != portainer.ContainerEnginePodman) {
		return errors.New("invalid container engine value. Value must be one of: 'docker' or 'podman'")
	}

	groupID, _ := request.RetrieveNumericMultiPartFormValue(r, "GroupID", true)
	if groupID == 0 {
		groupID = 1
	}
	payload.GroupID = groupID

	var tagIDs []portainer.TagID
	if err := request.RetrieveMultiPartFormJSONValue(r, "TagIds", &tagIDs, true); err != nil {
		return errors.New("invalid TagIds parameter")
	}
	payload.TagIDs = tagIDs
	if payload.TagIDs == nil {
		payload.TagIDs = make([]portainer.TagID, 0)
	}

	// TLS only ever secured a remote Docker API; remote hosts are removed (TAI-007).
	if useTLS, _ := request.RetrieveBooleanMultiPartFormValue(r, "TLS", true); useTLS {
		return portainer.ErrRemoteEnvironmentNotSupported
	}

	switch payload.EndpointCreationType {
	case azureEnvironment:
		azureApplicationID, err := request.RetrieveMultiPartFormValue(r, "AzureApplicationID", false)
		if err != nil {
			return errors.New("invalid Azure application ID")
		}

		payload.AzureApplicationID = azureApplicationID

		azureTenantID, err := request.RetrieveMultiPartFormValue(r, "AzureTenantID", false)
		if err != nil {
			return errors.New("invalid Azure tenant ID")
		}
		payload.AzureTenantID = azureTenantID

		azureAuthenticationKey, err := request.RetrieveMultiPartFormValue(r, "AzureAuthenticationKey", false)
		if err != nil {
			return errors.New("invalid Azure authentication key")
		}
		payload.AzureAuthenticationKey = azureAuthenticationKey

	default:
		endpointURL, err := request.RetrieveMultiPartFormValue(r, "URL", true)
		if err != nil {
			return errors.New("invalid environment URL")
		}

		// Only the local Docker or Podman socket can be added (TAI-007).
		if !portainer.IsLocalSocketURL(endpointURL) {
			return portainer.ErrRemoteEnvironmentNotSupported
		}
		payload.URL = endpointURL

		publicURL, _ := request.RetrieveMultiPartFormValue(r, "PublicURL", true)
		payload.PublicURL = publicURL
	}

	gpus := make([]portainer.Pair, 0)
	if err := request.RetrieveMultiPartFormJSONValue(r, "Gpus", &gpus, true); err != nil {
		return errors.New("invalid Gpus parameter")
	}

	payload.Gpus = gpus

	return nil
}

// @id EndpointCreate
// @summary Create a new environment(endpoint)
// @description  Create a new environment(endpoint) that will be used to manage an environment(endpoint).
// @description **Access policy**: administrator
// @tags endpoints
// @accept multipart/form-data
// @produce json
// @param Name formData string true "Name that will be used to identify this environment(endpoint) (example: my-environment)"
// @param EndpointCreationType formData endpointCreationEnum true "Environment(Endpoint) type. Value must be one of: 1 (Local Docker environment), 3 (Azure environment)" Enum(1,3)
// @param ContainerEngine formData string false "Container engine used by the environment(endpoint). Value must be one of: 'docker' or 'podman'"
// @param URL formData string false "Local Docker or Podman socket (unix:// or npipe://). Defaults to local if not specified (Linux: /var/run/docker.sock, Windows: //./pipe/docker_engine)."
// @param PublicURL formData string false "URL or IP address where exposed containers will be reachable. Defaults to URL if not specified (example: docker.mydomain.tld:2375)"
// @param GroupID formData int false "Environment(Endpoint) group identifier. If not specified will default to 1 (unassigned)."
// @param AzureApplicationID formData string false "Azure application ID. Required if environment(endpoint) type is set to 3"
// @param AzureTenantID formData string false "Azure tenant ID. Required if environment(endpoint) type is set to 3"
// @param AzureAuthenticationKey formData string false "Azure authentication key. Required if environment(endpoint) type is set to 3"
// @param TagIds formData string false "JSON-parsable array of tag identifiers to which this environment(endpoint) is associated"
// @param Gpus formData string false "List of GPUs - json stringified array of {name, value} structs"
// @success 200 {object} portainer.Endpoint "Success"
// @failure 400 "Invalid request"
// @failure 409 "Name is not unique"
// @failure 500 "Server error"
// @router /endpoints [post]
func (handler *Handler) endpointCreate(w http.ResponseWriter, r *http.Request) *httperror.HandlerError {
	payload := &endpointCreatePayload{}
	if err := payload.Validate(r); err != nil {
		return httperror.BadRequest("Invalid request payload", err)
	}

	isUnique, err := handler.isNameUnique(payload.Name, 0)
	if err != nil {
		return httperror.InternalServerError("Unable to check if name is unique", err)
	}

	if !isUnique {
		return httperror.Conflict("Name is not unique", nil)
	}

	endpoint, endpointCreationError := handler.createEndpoint(handler.DataStore, payload)
	if endpointCreationError != nil {
		return endpointCreationError
	}

	if _, err := handler.DataStore.EndpointGroup().Read(endpoint.GroupID); err != nil {
		return httperror.InternalServerError("Unable to find an environment group inside the database", err)
	}

	relationObject := &portainer.EndpointRelation{
		EndpointID: endpoint.ID,
		EdgeStacks: map[portainer.EdgeStackID]bool{},
	}

	if err := handler.DataStore.EndpointRelation().Create(relationObject); err != nil {
		return httperror.InternalServerError("Unable to persist the relation object inside the database", err)
	}

	return response.JSON(w, endpoint)
}

func (handler *Handler) createEndpoint(tx dataservices.DataStoreTx, payload *endpointCreatePayload) (*portainer.Endpoint, *httperror.HandlerError) {
	switch payload.EndpointCreationType {
	case azureEnvironment:
		return handler.createAzureEndpoint(tx, payload)
	}

	return handler.createUnsecuredEndpoint(tx, payload)
}

func (handler *Handler) createAzureEndpoint(tx dataservices.DataStoreTx, payload *endpointCreatePayload) (*portainer.Endpoint, *httperror.HandlerError) {
	credentials := portainer.AzureCredentials{
		ApplicationID:     payload.AzureApplicationID,
		TenantID:          payload.AzureTenantID,
		AuthenticationKey: payload.AzureAuthenticationKey,
	}

	httpClient := client.NewHTTPClient()
	if _, err := httpClient.ExecuteAzureAuthenticationRequest(&credentials); err != nil {
		return nil, httperror.InternalServerError("Unable to authenticate against Azure", err)
	}

	endpointID := tx.Endpoint().GetNextIdentifier()
	endpoint := &portainer.Endpoint{
		ID:                 portainer.EndpointID(endpointID),
		Name:               payload.Name,
		URL:                "https://management.azure.com",
		Type:               portainer.AzureEnvironment,
		GroupID:            portainer.EndpointGroupID(payload.GroupID),
		PublicURL:          payload.PublicURL,
		Gpus:               payload.Gpus,
		UserAccessPolicies: portainer.UserAccessPolicies{},
		TeamAccessPolicies: portainer.TeamAccessPolicies{},
		AzureCredentials:   credentials,
		TagIDs:             payload.TagIDs,
		Status:             portainer.EndpointStatusUp,
		Snapshots:          []portainer.DockerSnapshot{},
		Kubernetes:         portainer.KubernetesDefault(),
	}

	if err := handler.saveEndpointAndUpdateAuthorizations(tx, endpoint); err != nil {
		return nil, httperror.InternalServerError("An error occurred while trying to create the environment", err)
	}

	return endpoint, nil
}

func (handler *Handler) createUnsecuredEndpoint(tx dataservices.DataStoreTx, payload *endpointCreatePayload) (*portainer.Endpoint, *httperror.HandlerError) {
	endpointType := portainer.DockerEnvironment

	if payload.URL == "" {
		payload.URL = "unix:///var/run/docker.sock"
		if runtime.GOOS == "windows" {
			payload.URL = "npipe:////./pipe/docker_engine"
		}
	}

	endpointID := tx.Endpoint().GetNextIdentifier()
	endpoint := &portainer.Endpoint{
		ID:              portainer.EndpointID(endpointID),
		Name:            payload.Name,
		URL:             payload.URL,
		Type:            endpointType,
		ContainerEngine: payload.ContainerEngine,
		GroupID:         portainer.EndpointGroupID(payload.GroupID),
		PublicURL:       payload.PublicURL,
		Gpus:            payload.Gpus,
		TLSConfig: portainer.TLSConfiguration{
			TLS: false,
		},
		UserAccessPolicies: portainer.UserAccessPolicies{},
		TeamAccessPolicies: portainer.TeamAccessPolicies{},
		TagIDs:             payload.TagIDs,
		Status:             portainer.EndpointStatusUp,
		Snapshots:          []portainer.DockerSnapshot{},
		Kubernetes:         portainer.KubernetesDefault(),
	}

	if err := handler.snapshotAndPersistEndpoint(tx, endpoint); err != nil {
		return nil, err
	}

	return endpoint, nil
}

func (handler *Handler) snapshotAndPersistEndpoint(tx dataservices.DataStoreTx, endpoint *portainer.Endpoint) *httperror.HandlerError {
	// HACK: this bypasses the interface to avoid a deadlock and an import cycle
	snapshotService, ok := handler.SnapshotService.(*snapshot.Service)
	if !ok {
		return httperror.InternalServerError("Unable to use a concrete instance of the snapshot service", errors.New("unable to use a concrete instance of the snapshot service"))
	}

	if err := snapshotService.SnapshotEndpointTx(tx, endpoint); err != nil {
		return httperror.InternalServerError("Unable to initiate communications with environment", err)
	}

	if err := handler.saveEndpointAndUpdateAuthorizations(tx, endpoint); err != nil {
		return httperror.InternalServerError("An error occurred while trying to create the environment", err)
	}

	return nil
}

func (handler *Handler) saveEndpointAndUpdateAuthorizations(tx dataservices.DataStoreTx, endpoint *portainer.Endpoint) error {
	endpoint.SecuritySettings = portainer.DefaultEndpointSecuritySettings()

	if err := tx.Endpoint().Create(endpoint); err != nil {
		return err
	}

	for _, tagID := range endpoint.TagIDs {
		if err := tx.Tag().UpdateTagFunc(tagID, func(tag *portainer.Tag) {
			tag.Endpoints[endpoint.ID] = true
		}); err != nil {
			return err
		}
	}

	return nil
}
