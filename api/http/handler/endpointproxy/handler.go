package endpointproxy

import (
	"github.com/gorilla/mux"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/http/proxy"
	"github.com/portainer/portainer/api/http/security"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"
)

// Handler is the HTTP handler used to proxy requests to external APIs.
type Handler struct {
	*mux.Router
	DataStore      dataservices.DataStore
	requestBouncer security.BouncerService
	ProxyManager   *proxy.Manager
}

// NewHandler creates a handler to proxy requests to external APIs.
func NewHandler(bouncer security.BouncerService) *Handler {
	h := &Handler{
		Router:         mux.NewRouter(),
		requestBouncer: bouncer,
	}
	// The Azure API proxy (/{id}/azure) is removed with Azure Container
	// Instances (TAI-008).
	h.PathPrefix("/{id}/docker").Handler(
		bouncer.AuthenticatedAccess(httperror.LoggerHandler(h.proxyRequestsToDockerAPI)))
	// The Portainer Agent routes (/{id}/agent/docker, /{id}/agent/host) are
	// removed with Agent environments (TAI-007).
	return h
}
