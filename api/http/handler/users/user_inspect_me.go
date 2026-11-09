package users

import (
	"net/http"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/http/security"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"
	"github.com/portainer/portainer/pkg/libhttp/response"
)

type CurrentUserInspectResponse struct {
	*portainer.User
}

// @id CurrentUserInspect
// @summary Inspect the local operator
// @description Retrieve the local operator's record (UI preferences).
// @description User passwords are filtered out, and should never be accessible.
// @description **Access policy**: local
// @tags users
// @produce json
// @success 200 {object} portainer.User "Success"
// @failure 400 "Invalid request"
// @failure 403 "Permission denied"
// @failure 404 "User not found"
// @failure 500 "Server error"
// @router /users/me [get]
func (handler *Handler) userInspectMe(w http.ResponseWriter, r *http.Request) *httperror.HandlerError {
	securityContext, err := security.RetrieveRestrictedRequestContext(r)
	if err != nil {
		return httperror.InternalServerError("Unable to retrieve info from request context", err)
	}

	user, err := handler.DataStore.User().Read(securityContext.UserID)
	if handler.DataStore.IsErrObjectNotFound(err) && securityContext.User != nil {
		// the local operator has not been stored yet
		u := *securityContext.User
		user = &u
	} else if err != nil {
		return httperror.InternalServerError("Unable to find a user with the specified identifier inside the database", err)
	}

	hideFields(user)
	return response.JSON(
		w,
		&CurrentUserInspectResponse{
			User: user,
		},
	)
}
