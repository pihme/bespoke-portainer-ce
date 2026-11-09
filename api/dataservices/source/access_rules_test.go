package source

import (
	"testing"

	portainer "github.com/portainer/portainer/api"

	"github.com/stretchr/testify/require"
)

func Test_UserCanReadSource_AdministratorsOnly(t *testing.T) {
	standardUser := NewUserContext(&portainer.User{ID: 2, Role: portainer.StandardUserRole}, []portainer.TeamMembership{})
	teamMember := NewUserContext(&portainer.User{ID: 3, Role: portainer.StandardUserRole}, []portainer.TeamMembership{{TeamID: 7}})

	adminOnly := &portainer.Source{AdministratorsOnly: true}
	require.False(t, userCanReadSource(adminOnly, standardUser))

	// AdministratorsOnly is a hard enforcement: no user or team access overrides
	// it. Sharing a source with a non-admin requires demoting the flag, as the
	// FindOrCreateGitSource auto-grant does.
	granted := &portainer.Source{AdministratorsOnly: true, UserAccesses: []portainer.UserID{2}}
	require.False(t, userCanReadSource(granted, standardUser))

	teamGranted := &portainer.Source{AdministratorsOnly: true, TeamAccesses: []portainer.TeamID{7}}
	require.False(t, userCanReadSource(teamGranted, teamMember))
}

func Test_UserCanReadSource_PublicAdminUserAndTeam(t *testing.T) {
	admin := InsecureNewAdminContext()
	user := NewUserContext(&portainer.User{ID: 4, Role: portainer.StandardUserRole}, []portainer.TeamMembership{})
	teammate := NewUserContext(&portainer.User{ID: 5, Role: portainer.StandardUserRole}, []portainer.TeamMembership{{TeamID: 20}})
	outsider := NewUserContext(&portainer.User{ID: 6, Role: portainer.StandardUserRole}, []portainer.TeamMembership{{TeamID: 99}})

	require.False(t, userCanReadSource(nil, user))
	require.False(t, userCanReadSource(&portainer.Source{}, nil))

	public := &portainer.Source{Public: true}
	require.True(t, userCanReadSource(public, user))
	require.True(t, userCanReadSource(public, admin))

	byUser := &portainer.Source{UserAccesses: []portainer.UserID{4}}
	require.True(t, userCanReadSource(byUser, user))
	require.False(t, userCanReadSource(byUser, outsider))

	byTeam := &portainer.Source{TeamAccesses: []portainer.TeamID{20}}
	require.True(t, userCanReadSource(byTeam, teammate))
	require.False(t, userCanReadSource(byTeam, outsider))
	require.False(t, userCanReadSource(byTeam, user)) // no teams
}

func Test_UserCanWriteSource_AdminOwnerAndDenied(t *testing.T) {
	admin := InsecureNewAdminContext()
	owner := NewUserContext(&portainer.User{ID: 8, Role: portainer.StandardUserRole}, []portainer.TeamMembership{})
	other := NewUserContext(&portainer.User{ID: 9, Role: portainer.StandardUserRole}, []portainer.TeamMembership{})

	require.False(t, userCanWriteSource(nil, owner))
	require.False(t, userCanWriteSource(&portainer.Source{}, nil))

	owned := &portainer.Source{OwnerID: 8, UserAccesses: []portainer.UserID{8}}
	require.True(t, userCanWriteSource(owned, admin))
	require.True(t, userCanWriteSource(owned, owner))
	require.False(t, userCanWriteSource(owned, other))

	// owner without read access cannot write
	noRead := &portainer.Source{OwnerID: 8, AdministratorsOnly: true}
	require.False(t, userCanWriteSource(noRead, owner))
	require.True(t, userCanWriteSource(noRead, admin))
}

func Test_FilterSources_KeepsReadableOnly(t *testing.T) {
	user := NewUserContext(&portainer.User{ID: 2, Role: portainer.StandardUserRole}, []portainer.TeamMembership{})
	sources := []portainer.Source{
		{Name: "public", Public: true},
		{Name: "admin", AdministratorsOnly: true},
		{Name: "mine", UserAccesses: []portainer.UserID{2}},
	}

	filtered := filterSources(sources, user)
	require.Len(t, filtered, 2)
	require.Equal(t, "public", filtered[0].Name)
	require.Equal(t, "mine", filtered[1].Name)
}

func Test_EnforceUserPermissions_ReadAndWrite(t *testing.T) {
	admin := InsecureNewAdminContext()
	user := NewUserContext(&portainer.User{ID: 2, Role: portainer.StandardUserRole}, []portainer.TeamMembership{})
	src := &portainer.Source{OwnerID: 2, UserAccesses: []portainer.UserID{2}}

	require.NoError(t, enforceUserPermissions(admin, src, actionRead))
	require.NoError(t, enforceUserPermissions(user, src, actionWrite))

	locked := &portainer.Source{AdministratorsOnly: true}
	require.ErrorIs(t, enforceUserPermissions(user, locked, actionRead), ErrNotEnoughPermission)
	require.ErrorIs(t, enforceUserPermissions(user, locked, actionWrite), ErrNotEnoughPermission)
}
