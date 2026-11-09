package users

import (
	"net/http"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/http/security"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"

	"github.com/gorilla/mux"
)

func hideFields(user *portainer.User) {
	user.Password = ""
}

// Handler is the HTTP handler for the local operator's UI preferences and
// personal Helm repositories. There is no user management (TAI-001).
type Handler struct {
	*mux.Router
	bouncer   security.BouncerService
	DataStore dataservices.DataStore
}

// NewHandler creates a handler for the local operator.
func NewHandler(bouncer security.BouncerService) *Handler {
	h := &Handler{
		Router:  mux.NewRouter(),
		bouncer: bouncer,
	}

	authenticatedRouter := h.NewRoute().Subrouter()
	authenticatedRouter.Use(bouncer.AuthenticatedAccess)

	authenticatedRouter.Handle("/users/me", httperror.LoggerHandler(h.userInspectMe)).Methods(http.MethodGet)
	authenticatedRouter.Handle("/users/{id}", httperror.LoggerHandler(h.userInspect)).Methods(http.MethodGet)
	authenticatedRouter.Handle("/users/{id}", httperror.LoggerHandler(h.userUpdate)).Methods(http.MethodPut)

	// Helm repositories

	return h
}
