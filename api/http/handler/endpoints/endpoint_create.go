package endpoints

import (
	"errors"
	"net/http"
	"runtime"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/internal/snapshot"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"
	"github.com/portainer/portainer/pkg/libhttp/request"
	"github.com/portainer/portainer/pkg/libhttp/response"
)

type endpointCreatePayload struct {
	Name                 string
	URL                  string
	EndpointCreationType endpointCreationEnum
	PublicURL            string
	Gpus                 []portainer.Pair
	ContainerEngine      string
}

type endpointCreationEnum int

// unassignedGroupID is the built-in Unassigned environment group. It is the
// only group since environment groups were removed (TAI-013).
const unassignedGroupID portainer.EndpointGroupID = 1

const (
	_ endpointCreationEnum = iota
	localDockerEnvironment
	// 2 was the Agent environment, removed with the Portainer Agent (TAI-007).
	// 3 was the Azure environment, removed with Azure Container Instances (TAI-008).
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

	if err == nil && endpointCreationType == 3 {
		return portainer.ErrAzureEnvironmentNotSupported
	}

	if err != nil || endpointCreationType != int(localDockerEnvironment) {
		return errors.New("invalid environment type value. Value must be 1 (Docker environment)")
	}
	payload.EndpointCreationType = endpointCreationEnum(endpointCreationType)

	payload.ContainerEngine, err = request.RetrieveMultiPartFormValue(r, "ContainerEngine", true)
	if err != nil || (payload.ContainerEngine != "" && payload.ContainerEngine != portainer.ContainerEngineDocker && payload.ContainerEngine != portainer.ContainerEnginePodman) {
		return errors.New("invalid container engine value. Value must be one of: 'docker' or 'podman'")
	}

	// Environment groups and tags are removed (TAI-013): the GroupID and
	// TagIds form values are ignored and every new environment joins the
	// built-in Unassigned group with no tags.

	// TLS only ever secured a remote Docker API; remote hosts are removed (TAI-007).
	if useTLS, _ := request.RetrieveBooleanMultiPartFormValue(r, "TLS", true); useTLS {
		return portainer.ErrRemoteEnvironmentNotSupported
	}

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
// @param EndpointCreationType formData endpointCreationEnum true "Environment(Endpoint) type. Value must be 1 (Local Docker environment)" Enum(1)
// @param ContainerEngine formData string false "Container engine used by the environment(endpoint). Value must be one of: 'docker' or 'podman'"
// @param URL formData string false "Local Docker or Podman socket (unix:// or npipe://). Defaults to local if not specified (Linux: /var/run/docker.sock, Windows: //./pipe/docker_engine)."
// @param PublicURL formData string false "URL or IP address where exposed containers will be reachable. Defaults to URL if not specified (example: docker.mydomain.tld:2375)"
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
	return handler.createUnsecuredEndpoint(tx, payload)
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
		GroupID:         unassignedGroupID,
		PublicURL:       payload.PublicURL,
		Gpus:            payload.Gpus,
		TLSConfig: portainer.TLSConfiguration{
			TLS: false,
		},
		UserAccessPolicies: portainer.UserAccessPolicies{},
		TeamAccessPolicies: portainer.TeamAccessPolicies{},
		TagIDs:             []portainer.TagID{},
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

	return tx.Endpoint().Create(endpoint)
}
