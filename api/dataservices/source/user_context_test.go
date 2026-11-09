package source

import (
	"testing"

	portainer "github.com/portainer/portainer/api"

	"github.com/stretchr/testify/require"
)

func Test_NewUserContext_ExposesIDRoleAndMemberships(t *testing.T) {
	memberships := []portainer.TeamMembership{{TeamID: 4}, {TeamID: 5}}
	ctx := NewUserContext(&portainer.User{ID: 42, Role: portainer.StandardUserRole}, memberships)

	require.Equal(t, portainer.UserID(42), ctx.ID())
	require.False(t, ctx.IsAdmin())
	require.Equal(t, memberships, ctx.TeamMemberships())

	admin := InsecureNewAdminContext()
	require.True(t, admin.IsAdmin())
	require.Zero(t, admin.ID())
}
