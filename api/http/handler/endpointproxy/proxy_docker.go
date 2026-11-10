package endpointproxy

import (
	"net/http"
	"strconv"

	portainer "github.com/portainer/portainer/api"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"
	"github.com/portainer/portainer/pkg/libhttp/request"
)

func (handler *Handler) proxyRequestsToDockerAPI(w http.ResponseWriter, r *http.Request) *httperror.HandlerError {
	endpointID, err := request.RetrieveNumericRouteVariableValue(r, "id")
	if err != nil {
		return httperror.BadRequest("Invalid environment identifier route variable", err)
	}

	endpoint, err := handler.DataStore.Endpoint().Endpoint(portainer.EndpointID(endpointID))
	if handler.DataStore.IsErrObjectNotFound(err) {
		return httperror.NotFound("Unable to find an environment with the specified identifier inside the database", err)
	} else if err != nil {
		return httperror.InternalServerError("Unable to find an environment with the specified identifier inside the database", err)
	}

	err = handler.requestBouncer.AuthorizedEndpointOperation(r, endpoint)
	if err != nil {
		return httperror.Forbidden("Permission denied to access environment", err)
	}

	if endpoint.Type == portainer.EdgeAgentOnDockerEnvironment {
		return httperror.BadRequest(portainer.ErrEdgeEnvironmentNotSupported.Error(), portainer.ErrEdgeEnvironmentNotSupported)
	}

	if portainer.IsAgentEnvironmentType(endpoint.Type) {
		return httperror.BadRequest(portainer.ErrAgentEnvironmentNotSupported.Error(), portainer.ErrAgentEnvironmentNotSupported)
	}

	var proxy http.Handler
	proxy = handler.ProxyManager.GetEndpointProxy(endpoint)
	if proxy == nil {
		proxy, err = handler.ProxyManager.CreateAndRegisterEndpointProxy(endpoint)
		if err != nil {
			return httperror.InternalServerError("Unable to create proxy", err)
		}
	}

	id := strconv.Itoa(endpointID)

	http.StripPrefix("/"+id+"/docker", proxy).ServeHTTP(w, r)
	return nil
}
