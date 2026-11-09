package stacks

import (
	"context"
	"net/http"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/http/security"
)

func securityStoreNonAdmin(req *http.Request, user *portainer.User) context.Context {
	return security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		IsAdmin: false,
		UserID:  user.ID,
		User:    user,
	})
}
