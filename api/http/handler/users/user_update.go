package users

import (
	"cmp"
	"net/http"

	portainer "github.com/portainer/portainer/api"
	httperrors "github.com/portainer/portainer/api/http/errors"
	"github.com/portainer/portainer/api/http/security"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"
	"github.com/portainer/portainer/pkg/libhttp/request"
	"github.com/portainer/portainer/pkg/libhttp/response"
)

type themePayload struct {
	// Color represents the color theme of the UI
	Color *string `json:"color" example:"dark" enums:"dark,light,highcontrast,auto"`
}

type userUpdatePayload struct {
	UseCache *bool `example:"true"`
	Theme    *themePayload
}

func (payload *userUpdatePayload) Validate(r *http.Request) error {
	return nil
}

// @id UserUpdate
// @summary Update the UI preferences
// @description Update the local operator's theme and UI cache preference.
// @description **Access policy**: local
// @tags users
// @accept json
// @produce json
// @param id path int true "Local operator identifier"
// @param body body userUpdatePayload true "UI preferences"
// @success 200 {object} portainer.User "Success"
// @failure 400 "Invalid request"
// @failure 403 "Permission denied"
// @failure 404 "User not found"
// @failure 500 "Server error"
// @router /users/{id} [put]
func (handler *Handler) userUpdate(w http.ResponseWriter, r *http.Request) *httperror.HandlerError {
	userID, err := request.RetrieveNumericRouteVariableValue(r, "id")
	if err != nil {
		return httperror.BadRequest("Invalid user identifier route variable", err)
	}

	tokenData, err := security.RetrieveTokenData(r)
	if err != nil {
		return httperror.InternalServerError("Unable to retrieve the local operator", err)
	}

	if tokenData.ID != portainer.UserID(userID) {
		return httperror.Forbidden("Only the local operator's preferences can be updated", httperrors.ErrUnauthorized)
	}

	var payload userUpdatePayload
	if err := request.DecodeAndValidateJSONPayload(r, &payload); err != nil {
		return httperror.BadRequest("Invalid request payload", err)
	}

	user, err := handler.DataStore.User().Read(portainer.UserID(userID))
	if handler.DataStore.IsErrObjectNotFound(err) {
		return httperror.NotFound("Unable to find a user with the specified identifier inside the database", err)
	} else if err != nil {
		return httperror.InternalServerError("Unable to find a user with the specified identifier inside the database", err)
	}

	if payload.Theme != nil {
		user.ThemeSettings.Color = *cmp.Or(payload.Theme.Color, &user.ThemeSettings.Color)
	}

	user.UseCache = *cmp.Or(payload.UseCache, &user.UseCache)

	if err := handler.DataStore.User().Update(user.ID, user); err != nil {
		return httperror.InternalServerError("Unable to persist user changes inside the database", err)
	}

	hideFields(user)

	return response.JSON(w, user)
}
