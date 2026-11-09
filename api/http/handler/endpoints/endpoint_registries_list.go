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

// @id endpointRegistriesList
// @summary List Registries on environment
// @description List all registries based on the current user authorizations in current environment.
// @description **Access policy**: authenticated
// @tags endpoints
// @produce json
// @param id path int true "Environment(Endpoint) identifier"
// @success 200 {array} portainer.Registry "Success"
// @failure 500 "Server error"
// @router /endpoints/{id}/registries [get]
func (handler *Handler) endpointRegistriesList(w http.ResponseWriter, r *http.Request) *httperror.HandlerError {
	endpointID, err := request.RetrieveNumericRouteVariableValue(r, "id")
	if err != nil {
		return httperror.BadRequest("Invalid environment identifier route variable", err)
	}

	var registries []portainer.Registry
	err = handler.DataStore.ViewTx(func(tx dataservices.DataStoreTx) error {
		registries, err = handler.listRegistries(tx, r, portainer.EndpointID(endpointID))
		return err
	})

	return response.TxResponse(w, registries, err)
}

func (handler *Handler) listRegistries(tx dataservices.DataStoreTx, r *http.Request, endpointID portainer.EndpointID) ([]portainer.Registry, error) {
	securityContext, err := security.RetrieveRestrictedRequestContext(r)
	if err != nil {
		return nil, httperror.InternalServerError("Unable to retrieve info from request context", err)
	}

	user, err := tx.User().Read(securityContext.UserID)
	if err != nil {
		return nil, httperror.InternalServerError("Unable to retrieve user from the database", err)
	}

	endpoint, err := tx.Endpoint().Endpoint(endpointID)
	if tx.IsErrObjectNotFound(err) {
		return nil, httperror.NotFound("Unable to find an environment with the specified identifier inside the database", err)
	} else if err != nil {
		return nil, httperror.InternalServerError("Unable to find an environment with the specified identifier inside the database", err)
	}

	isAdmin := securityContext.IsAdmin

	registries, err := tx.Registry().ReadAll()
	if err != nil {
		return nil, httperror.InternalServerError("Unable to retrieve registries from the database", err)
	}

	registries, handleError := handler.filterRegistriesByAccess(tx, r, registries, endpoint, user, securityContext.UserMemberships)
	if handleError != nil {
		return nil, handleError
	}

	for idx := range registries {
		hideRegistryFields(&registries[idx], !isAdmin)
	}

	return registries, err
}

func (handler *Handler) filterRegistriesByAccess(tx dataservices.DataStoreTx, r *http.Request, registries []portainer.Registry, endpoint *portainer.Endpoint, user *portainer.User, memberships []portainer.TeamMembership) ([]portainer.Registry, *httperror.HandlerError) {
	return security.FilterRegistries(registries, user, memberships, endpoint.ID), nil
}

func hideRegistryFields(registry *portainer.Registry, hideAccesses bool) {
	registry.Password = ""
	registry.ManagementConfiguration = nil
	if hideAccesses {
		registry.RegistryAccesses = nil
	}
}
