package stackutils

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/stretchr/testify/require"
)

func TestUserIsAdminOrEndpointAdmin(t *testing.T) {
	t.Parallel()
	require.True(t, UserIsAdminOrEndpointAdmin(&portainer.User{Role: portainer.AdministratorRole}))
	require.False(t, UserIsAdminOrEndpointAdmin(&portainer.User{Role: portainer.StandardUserRole}))
}

func TestResourceControlID(t *testing.T) {
	t.Parallel()
	require.Equal(t, "3_compose-app", ResourceControlID(3, "compose-app"))
}

func TestIsRelativePathStackAlwaysFalseInCE(t *testing.T) {
	t.Parallel()
	require.False(t, IsRelativePathStack(&portainer.Stack{Name: "any"}))
}
