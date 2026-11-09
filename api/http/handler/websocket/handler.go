package websocket

import (
	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/http/security"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

// Handler is the HTTP handler used to handle websocket operations.
type Handler struct {
	*mux.Router
	DataStore            dataservices.DataStore
	SignatureService     portainer.DigitalSignatureService
	ReverseTunnelService portainer.ReverseTunnelService
	requestBouncer       security.BouncerService
	connectionUpgrader   websocket.Upgrader
}

// NewHandler creates a handler to manage websocket operations.
func NewHandler(bouncer security.BouncerService) *Handler {
	h := &Handler{
		Router:             mux.NewRouter(),
		connectionUpgrader: websocket.Upgrader{},
		requestBouncer:     bouncer,
	}
	h.PathPrefix("/websocket/exec").Handler(
		bouncer.AuthenticatedAccess(httperror.LoggerHandler(h.websocketExec)))
	h.PathPrefix("/websocket/attach").Handler(
		bouncer.AuthenticatedAccess(httperror.LoggerHandler(h.websocketAttach)))
	return h
}
