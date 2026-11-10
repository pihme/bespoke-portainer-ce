package authorization

import (
	"testing"

	portainer "github.com/portainer/portainer/api"

	"github.com/stretchr/testify/require"
)

func TestNewResourceControls(t *testing.T) {
	t.Parallel()

	adminOnly := NewAdministratorsOnlyResourceControl("res-1", portainer.ContainerResourceControl)
	require.True(t, adminOnly.AdministratorsOnly)
	require.False(t, adminOnly.Public)
	require.Equal(t, "res-1", adminOnly.ResourceID)
	require.Equal(t, portainer.ContainerResourceControl, adminOnly.Type)

	private := NewPrivateResourceControl("res-2", portainer.ServiceResourceControl, 7)
	require.False(t, private.AdministratorsOnly)
	require.Len(t, private.UserAccesses, 1)
	require.Equal(t, portainer.UserID(7), private.UserAccesses[0].UserID)
	require.Equal(t, portainer.ReadWriteAccessLevel, private.UserAccesses[0].AccessLevel)

	system := NewSystemResourceControl("res-3", portainer.NetworkResourceControl)
	require.True(t, system.Public)
	require.True(t, system.System)

	public := NewPublicResourceControl("res-4", portainer.VolumeResourceControl)
	require.True(t, public.Public)
	require.False(t, public.System)

	restricted := NewRestrictedResourceControl(
		"res-5",
		portainer.StackResourceControl,
		[]portainer.UserID{1, 2},
		[]portainer.TeamID{10, 20},
	)
	require.Len(t, restricted.UserAccesses, 2)
	require.Len(t, restricted.TeamAccesses, 2)
	require.Equal(t, portainer.TeamID(10), restricted.TeamAccesses[0].TeamID)
}

func TestUserCanAccessResource(t *testing.T) {
	t.Parallel()
	require.False(t, UserCanAccessResource(1, nil, nil))

	rcUser := NewPrivateResourceControl("x", portainer.ContainerResourceControl, 5)
	require.True(t, UserCanAccessResource(5, nil, rcUser))
	require.False(t, UserCanAccessResource(6, nil, rcUser))

	rcTeam := NewRestrictedResourceControl("y", portainer.ContainerResourceControl, nil, []portainer.TeamID{3})
	require.True(t, UserCanAccessResource(1, []portainer.TeamID{3, 9}, rcTeam))
	require.False(t, UserCanAccessResource(1, []portainer.TeamID{9}, rcTeam))

	rcPublic := NewPublicResourceControl("z", portainer.ContainerResourceControl)
	require.True(t, UserCanAccessResource(99, nil, rcPublic))
}

func TestGetResourceControlByResourceIDAndType(t *testing.T) {
	t.Parallel()
	rcs := []portainer.ResourceControl{
		{ResourceID: "a", Type: portainer.ContainerResourceControl},
		{ResourceID: "parent", Type: portainer.NetworkResourceControl, SubResourceIDs: []string{"child"}},
	}

	got := GetResourceControlByResourceIDAndType("a", portainer.ContainerResourceControl, rcs)
	require.NotNil(t, got)
	require.Equal(t, "a", got.ResourceID)

	got = GetResourceControlByResourceIDAndType("child", portainer.VolumeResourceControl, rcs)
	require.NotNil(t, got)
	require.Equal(t, "parent", got.ResourceID)

	require.Nil(t, GetResourceControlByResourceIDAndType("missing", portainer.ContainerResourceControl, rcs))
}

func TestTeamIDs(t *testing.T) {
	t.Parallel()
	ids := TeamIDs([]portainer.TeamMembership{{TeamID: 1}, {TeamID: 2}})
	require.Equal(t, []portainer.TeamID{1, 2}, ids)
	require.Empty(t, TeamIDs(nil))
}
