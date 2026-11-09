package registries

import (
	"fmt"
	"net/http"

	portainer "github.com/portainer/portainer/api"
	httperrors "github.com/portainer/portainer/api/http/errors"
	"github.com/portainer/portainer/api/http/security"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"
	"github.com/portainer/portainer/pkg/libhttp/request"
	"github.com/portainer/portainer/pkg/libhttp/response"
)

// @id RegistryDelete
// @summary Remove a registry
// @description Remove a registry
// @description **Access policy**: restricted
// @tags registries
// @param id path int true "Registry identifier"
// @success 204 "Success"
// @failure 400 "Invalid request"
// @failure 404 "Registry not found"
// @failure 500 "Server error"
// @router /registries/{id} [delete]
func (handler *Handler) registryDelete(w http.ResponseWriter, r *http.Request) *httperror.HandlerError {
	securityContext, err := security.RetrieveRestrictedRequestContext(r)
	if err != nil {
		return httperror.InternalServerError("Unable to retrieve info from request context", err)
	} else if !securityContext.IsAdmin {
		return httperror.Forbidden("Permission denied to delete registry", httperrors.ErrResourceAccessDenied)
	}

	registryID, err := request.RetrieveNumericRouteVariableValue(r, "id")
	if err != nil {
		return httperror.BadRequest("Invalid registry identifier route variable", err)
	}

	if _, err := handler.DataStore.Registry().Read(portainer.RegistryID(registryID)); err != nil {
		return httperror.InternalServerError(fmt.Sprintf("Unable to load registry %d from the database", registryID), err)
	}

	if err := handler.DataStore.Registry().Delete(portainer.RegistryID(registryID)); err != nil {
		return httperror.InternalServerError("Unable to remove the registry from the database", err)
	}

	return response.Empty(w)
}
