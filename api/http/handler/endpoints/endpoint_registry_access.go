package endpoints

import (
	"net/http"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/http/security"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"
	"github.com/portainer/portainer/pkg/libhttp/request"
	"github.com/portainer/portainer/pkg/libhttp/response"
)

type registryAccessPayload struct {
	UserAccessPolicies portainer.UserAccessPolicies
	TeamAccessPolicies portainer.TeamAccessPolicies
}

func (payload *registryAccessPayload) Validate(r *http.Request) error {
	return nil
}

// @id endpointRegistryAccess
// @summary update registry access for environment
// @description **Access policy**: authenticated
// @tags endpoints
// @accept json
// @produce json
// @param id path int true "Environment(Endpoint) identifier"
// @param registryId path int true "Registry identifier"
// @param body body registryAccessPayload true "details"
// @success 204 "Success"
// @failure 400 "Invalid request"
// @failure 403 "Permission denied"
// @failure 404 "Endpoint not found"
// @failure 500 "Server error"
// @router /endpoints/{id}/registries/{registryId} [put]
func (handler *Handler) endpointRegistryAccess(w http.ResponseWriter, r *http.Request) *httperror.HandlerError {
	endpointID, err := request.RetrieveNumericRouteVariableValue(r, "id")
	if err != nil {
		return httperror.BadRequest("Invalid environment identifier route variable", err)
	}

	registryID, err := request.RetrieveNumericRouteVariableValue(r, "registryId")
	if err != nil {
		return httperror.BadRequest("Invalid registry identifier route variable", err)
	}

	err = handler.DataStore.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return handler.updateRegistryAccess(tx, r, portainer.EndpointID(endpointID), portainer.RegistryID(registryID))
	})

	return response.TxEmptyResponse(w, err)
}

func (handler *Handler) updateRegistryAccess(tx dataservices.DataStoreTx, r *http.Request, endpointID portainer.EndpointID, registryID portainer.RegistryID) error {
	endpoint, err := tx.Endpoint().Endpoint(endpointID)
	if tx.IsErrObjectNotFound(err) {
		return httperror.NotFound("Unable to find an environment with the specified identifier inside the database", err)
	} else if err != nil {
		return httperror.InternalServerError("Unable to find an environment with the specified identifier inside the database", err)
	}

	securityContext, err := security.RetrieveRestrictedRequestContext(r)
	if err != nil {
		return httperror.InternalServerError("Unable to retrieve info from request context", err)
	}

	err = handler.requestBouncer.AuthorizedEndpointOperation(r, endpoint)
	if err != nil {
		return httperror.Forbidden("Permission denied to access environment", err)
	}

	if !securityContext.IsAdmin {
		return httperror.Forbidden("User is not authorized", err)
	}

	registry, err := tx.Registry().Read(registryID)
	if tx.IsErrObjectNotFound(err) {
		return httperror.NotFound("Unable to find an environment with the specified identifier inside the database", err)
	} else if err != nil {
		return httperror.InternalServerError("Unable to find an environment with the specified identifier inside the database", err)
	}

	var payload registryAccessPayload
	err = request.DecodeAndValidateJSONPayload(r, &payload)
	if err != nil {
		return httperror.BadRequest("Invalid request payload", err)
	}

	if registry.RegistryAccesses == nil {
		registry.RegistryAccesses = portainer.RegistryAccesses{}
	}

	if _, ok := registry.RegistryAccesses[endpoint.ID]; !ok {
		registry.RegistryAccesses[endpoint.ID] = portainer.RegistryAccessPolicies{}
	}

	registryAccess := registry.RegistryAccesses[endpoint.ID]

	registryAccess.UserAccessPolicies = payload.UserAccessPolicies
	registryAccess.TeamAccessPolicies = payload.TeamAccessPolicies

	registry.RegistryAccesses[endpointID] = registryAccess

	return tx.Registry().Update(registry.ID, registry)
}
