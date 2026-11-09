package security

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/stretchr/testify/require"
)

func TestAuthorizedResourceControlUpdate_AdminAlwaysAllowed(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{
		AdministratorsOnly: true,
	}
	ctx := &RestrictedRequestContext{IsAdmin: true}

	require.True(t, AuthorizedResourceControlUpdate(rc, ctx))
}

func TestAuthorizedResourceControlUpdate_PublicAlwaysAllowed(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{
		Public: true,
	}
	ctx := &RestrictedRequestContext{IsAdmin: false}

	require.True(t, AuthorizedResourceControlUpdate(rc, ctx))
}

func TestAuthorizedResourceControlUpdate_AdministratorsOnlyDenied(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{
		AdministratorsOnly: true,
		UserAccesses: []portainer.UserResourceAccess{
			{UserID: 1, AccessLevel: portainer.ReadWriteAccessLevel},
		},
	}
	ctx := &RestrictedRequestContext{IsAdmin: false, UserID: 1}

	require.False(t, AuthorizedResourceControlUpdate(rc, ctx))
}

func TestAuthorizedResourceControlUpdate_EmptyAccessesDenied(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{}
	ctx := &RestrictedRequestContext{IsAdmin: false, UserID: 1}

	require.False(t, AuthorizedResourceControlUpdate(rc, ctx))
}

func TestAuthorizedResourceControlUpdate_UserAccessMatchingCurrentUser(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{
		UserAccesses: []portainer.UserResourceAccess{
			{UserID: 1, AccessLevel: portainer.ReadWriteAccessLevel},
		},
	}
	ctx := &RestrictedRequestContext{IsAdmin: false, UserID: 1}

	require.True(t, AuthorizedResourceControlUpdate(rc, ctx))
}

func TestAuthorizedResourceControlUpdate_UserAccessNotMatchingCurrentUser(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{
		UserAccesses: []portainer.UserResourceAccess{
			{UserID: 2, AccessLevel: portainer.ReadWriteAccessLevel},
		},
	}
	ctx := &RestrictedRequestContext{IsAdmin: false, UserID: 1}

	require.False(t, AuthorizedResourceControlUpdate(rc, ctx))
}

func TestAuthorizedResourceControlUpdate_TeamAccessUserMemberOfAllTeams(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{
		TeamAccesses: []portainer.TeamResourceAccess{
			{TeamID: 1, AccessLevel: portainer.ReadWriteAccessLevel},
			{TeamID: 2, AccessLevel: portainer.ReadWriteAccessLevel},
		},
	}
	ctx := &RestrictedRequestContext{
		IsAdmin: false,
		UserMemberships: []portainer.TeamMembership{
			{TeamID: 1},
			{TeamID: 2},
		},
	}

	require.True(t, AuthorizedResourceControlUpdate(rc, ctx))
}

func TestAuthorizedResourceControlUpdate_TeamAccessUserNotMemberOfAllTeams(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{
		TeamAccesses: []portainer.TeamResourceAccess{
			{TeamID: 1, AccessLevel: portainer.ReadWriteAccessLevel},
			{TeamID: 3, AccessLevel: portainer.ReadWriteAccessLevel},
		},
	}
	ctx := &RestrictedRequestContext{
		IsAdmin: false,
		UserMemberships: []portainer.TeamMembership{
			{TeamID: 1},
			{TeamID: 2},
		},
	}

	require.False(t, AuthorizedResourceControlUpdate(rc, ctx))
}

func TestAuthorizedResourceControlUpdate_TeamAccessUserNotMemberOfAnyTeam(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{
		TeamAccesses: []portainer.TeamResourceAccess{
			{TeamID: 5, AccessLevel: portainer.ReadWriteAccessLevel},
		},
	}
	ctx := &RestrictedRequestContext{
		IsAdmin: false,
		UserMemberships: []portainer.TeamMembership{
			{TeamID: 1},
		},
	}

	require.False(t, AuthorizedResourceControlUpdate(rc, ctx))
}

func TestAuthorizedResourceControlUpdate_MultipleUserAccessesDenied(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{
		UserAccesses: []portainer.UserResourceAccess{
			{UserID: 1, AccessLevel: portainer.ReadWriteAccessLevel},
			{UserID: 2, AccessLevel: portainer.ReadWriteAccessLevel},
		},
	}
	ctx := &RestrictedRequestContext{IsAdmin: false, UserID: 1}

	require.False(t, AuthorizedResourceControlUpdate(rc, ctx))
}

func TestAuthorizedResourceControlUpdate_UserAndTeamAccessCombinationDenied(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{
		UserAccesses: []portainer.UserResourceAccess{
			{UserID: 1, AccessLevel: portainer.ReadWriteAccessLevel},
		},
		TeamAccesses: []portainer.TeamResourceAccess{
			{TeamID: 1, AccessLevel: portainer.ReadWriteAccessLevel},
		},
	}
	ctx := &RestrictedRequestContext{
		IsAdmin: false,
		UserID:  1,
		UserMemberships: []portainer.TeamMembership{
			{TeamID: 1},
		},
	}

	require.False(t, AuthorizedResourceControlUpdate(rc, ctx))
}

func TestAuthorizedResourceControlUpdate_SelfUserAndMultipleForeignTeamsDenied(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{
		UserAccesses: []portainer.UserResourceAccess{
			{UserID: 1, AccessLevel: portainer.ReadWriteAccessLevel},
		},
		TeamAccesses: []portainer.TeamResourceAccess{
			{TeamID: 2, AccessLevel: portainer.ReadWriteAccessLevel},
			{TeamID: 3, AccessLevel: portainer.ReadWriteAccessLevel},
		},
	}
	ctx := &RestrictedRequestContext{IsAdmin: false, UserID: 1}

	require.False(t, AuthorizedResourceControlUpdate(rc, ctx))
}

func TestREQ_USR_08_AuthorizedResourceControlAccess_AdminAlwaysAllowed(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{}
	ctx := &RestrictedRequestContext{IsAdmin: true}

	require.True(t, AuthorizedResourceControlAccess(rc, ctx))
}

func TestREQ_USR_08_AuthorizedResourceControlAccess_PublicAlwaysAllowed(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{Public: true}
	ctx := &RestrictedRequestContext{IsAdmin: false, UserID: 1}

	require.True(t, AuthorizedResourceControlAccess(rc, ctx))
}

func TestREQ_USR_08_AuthorizedResourceControlAccess_MatchingUserAccess(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{
		UserAccesses: []portainer.UserResourceAccess{
			{UserID: 5, AccessLevel: portainer.ReadWriteAccessLevel},
		},
	}
	ctx := &RestrictedRequestContext{UserID: 5}

	require.True(t, AuthorizedResourceControlAccess(rc, ctx))
}

func TestREQ_USR_08_AuthorizedResourceControlAccess_MatchingTeamAccess(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{
		TeamAccesses: []portainer.TeamResourceAccess{
			{TeamID: 3, AccessLevel: portainer.ReadWriteAccessLevel},
		},
	}
	ctx := &RestrictedRequestContext{
		UserID: 9,
		UserMemberships: []portainer.TeamMembership{
			{TeamID: 3, UserID: 9},
		},
	}

	require.True(t, AuthorizedResourceControlAccess(rc, ctx))
}

func TestREQ_USR_08_AuthorizedResourceControlAccess_DeniedWithoutAccess(t *testing.T) {
	t.Parallel()

	rc := &portainer.ResourceControl{
		UserAccesses: []portainer.UserResourceAccess{
			{UserID: 2, AccessLevel: portainer.ReadWriteAccessLevel},
		},
		TeamAccesses: []portainer.TeamResourceAccess{
			{TeamID: 8, AccessLevel: portainer.ReadWriteAccessLevel},
		},
	}
	ctx := &RestrictedRequestContext{
		UserID: 1,
		UserMemberships: []portainer.TeamMembership{
			{TeamID: 1, UserID: 1},
		},
	}

	require.False(t, AuthorizedResourceControlAccess(rc, ctx))
}

func TestREQ_USR_07_AuthorizedAccess_UserPolicyGrantsAccess(t *testing.T) {
	t.Parallel()

	ok := AuthorizedAccess(
		1,
		nil,
		portainer.UserAccessPolicies{1: {}},
		nil,
	)
	require.True(t, ok)
}

func TestREQ_USR_07_AuthorizedAccess_TeamPolicyGrantsAccess(t *testing.T) {
	t.Parallel()

	ok := AuthorizedAccess(
		2,
		[]portainer.TeamMembership{{TeamID: 4, UserID: 2}},
		nil,
		portainer.TeamAccessPolicies{4: {}},
	)
	require.True(t, ok)
}

func TestREQ_USR_07_AuthorizedAccess_DeniedWithoutPolicy(t *testing.T) {
	t.Parallel()

	ok := AuthorizedAccess(
		2,
		[]portainer.TeamMembership{{TeamID: 4, UserID: 2}},
		portainer.UserAccessPolicies{9: {}},
		portainer.TeamAccessPolicies{8: {}},
	)
	require.False(t, ok)
}

func TestREQ_USR_07_AuthorizedEndpointAccess_GroupPolicyGrantsAccess(t *testing.T) {
	t.Parallel()

	endpoint := &portainer.Endpoint{ID: 1, GroupID: 10}
	group := &portainer.EndpointGroup{
		ID:                 10,
		UserAccessPolicies: portainer.UserAccessPolicies{3: {}},
	}

	ok := AuthorizedEndpointAccess(endpoint, group, 3, nil)
	require.True(t, ok)
}

func TestREQ_USR_07_AuthorizedEndpointAccess_EndpointPolicyWhenGroupDenies(t *testing.T) {
	t.Parallel()

	endpoint := &portainer.Endpoint{
		ID:                 1,
		GroupID:            10,
		UserAccessPolicies: portainer.UserAccessPolicies{3: {}},
	}
	group := &portainer.EndpointGroup{ID: 10}

	ok := AuthorizedEndpointAccess(endpoint, group, 3, nil)
	require.True(t, ok)
}

func TestREQ_USR_07_AuthorizedEndpointAccess_DeniedWhenNeitherAllows(t *testing.T) {
	t.Parallel()

	endpoint := &portainer.Endpoint{ID: 1, GroupID: 10}
	group := &portainer.EndpointGroup{ID: 10}

	ok := AuthorizedEndpointAccess(endpoint, group, 3, nil)
	require.False(t, ok)
}

func TestAuthorizedIsAdmin(t *testing.T) {
	t.Parallel()

	require.True(t, AuthorizedIsAdmin(&RestrictedRequestContext{IsAdmin: true}))
	require.False(t, AuthorizedIsAdmin(&RestrictedRequestContext{IsAdmin: false}))
}
