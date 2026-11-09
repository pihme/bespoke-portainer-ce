package security

import (
	"testing"

	portainer "github.com/portainer/portainer/api"

	"github.com/stretchr/testify/require"
)

func TestFilterEndpointsPanic(t *testing.T) {
	t.Parallel()
	endpoints := []portainer.Endpoint{{ID: 1}}
	groups := []portainer.EndpointGroup{}
	context := &RestrictedRequestContext{}

	FilterEndpoints(endpoints, groups, context)
}

func TestFilterUserTeams_MembershipOrderDiffersFromTeamOrder(t *testing.T) {
	t.Parallel()

	teams := []portainer.Team{{ID: 1, Name: "team1"}, {ID: 5, Name: "team5"}, {ID: 26, Name: "team26"}}
	context := &RestrictedRequestContext{
		UserID: 22,
		UserMemberships: []portainer.TeamMembership{
			{ID: 60, UserID: 22, TeamID: 26},
			{ID: 1, UserID: 22, TeamID: 1},
		},
	}

	filtered := FilterUserTeams(teams, context)

	require.Len(t, filtered, 2)
	require.ElementsMatch(t, []portainer.TeamID{1, 26}, []portainer.TeamID{filtered[0].ID, filtered[1].ID})
}

func TestLeaderTeamMembershipFilter_MatchesMembershipsOfLedTeams(t *testing.T) {
	t.Parallel()

	context := &RestrictedRequestContext{
		UserID: 22,
		UserMemberships: []portainer.TeamMembership{
			{ID: 1, UserID: 22, TeamID: 1, Role: portainer.TeamLeader},
			{ID: 2, UserID: 22, TeamID: 5, Role: 2},
		},
	}

	filter := LeaderTeamMembershipFilter(context)

	require.True(t, filter(portainer.TeamMembership{ID: 3, UserID: 99, TeamID: 1, Role: 2}))
	require.False(t, filter(portainer.TeamMembership{ID: 4, UserID: 22, TeamID: 5, Role: 2}))
}

func TestLeaderTeamMembershipFilter_NonLeaderMatchesNothing(t *testing.T) {
	t.Parallel()

	context := &RestrictedRequestContext{
		UserID:          22,
		UserMemberships: []portainer.TeamMembership{{ID: 1, UserID: 22, TeamID: 1, Role: 2}},
	}

	filter := LeaderTeamMembershipFilter(context)

	require.False(t, filter(portainer.TeamMembership{ID: 2, UserID: 22, TeamID: 1, Role: 2}))
}

func TestLeaderTeamMembershipFilter_IgnoresOtherUsersLeadership(t *testing.T) {
	t.Parallel()

	context := &RestrictedRequestContext{
		UserID:          22,
		UserMemberships: []portainer.TeamMembership{{ID: 1, UserID: 99, TeamID: 1, Role: portainer.TeamLeader}},
	}

	filter := LeaderTeamMembershipFilter(context)

	require.False(t, filter(portainer.TeamMembership{ID: 2, UserID: 22, TeamID: 1, Role: 2}))
}

func TestFilterUserTeams_AdminSeesAll(t *testing.T) {
	t.Parallel()

	teams := []portainer.Team{{ID: 1}, {ID: 2}, {ID: 3}}
	ctx := &RestrictedRequestContext{IsAdmin: true}

	filtered := FilterUserTeams(teams, ctx)

	require.Equal(t, teams, filtered)
}

func TestREQ_USR_07_FilterEndpoints_AdminSeesAll(t *testing.T) {
	t.Parallel()

	endpoints := []portainer.Endpoint{{ID: 1}, {ID: 2}}
	groups := []portainer.EndpointGroup{{ID: 1}}
	ctx := &RestrictedRequestContext{IsAdmin: true}

	filtered := FilterEndpoints(endpoints, groups, ctx)

	require.Equal(t, endpoints, filtered)
}

func TestREQ_USR_07_FilterEndpoints_KeepsAuthorizedLocalEndpoint(t *testing.T) {
	t.Parallel()

	endpoints := []portainer.Endpoint{
		{ID: 1, GroupID: 5, UserAccessPolicies: portainer.UserAccessPolicies{7: {}}},
		{ID: 2, GroupID: 5},
	}
	groups := []portainer.EndpointGroup{{ID: 5}}
	ctx := &RestrictedRequestContext{UserID: 7}

	filtered := FilterEndpoints(endpoints, groups, ctx)

	require.Len(t, filtered, 1)
	require.Equal(t, portainer.EndpointID(1), filtered[0].ID)
	require.Nil(t, filtered[0].UserAccessPolicies)
}

func TestREQ_USR_07_FilterEndpoints_GroupMembershipGrantsAccess(t *testing.T) {
	t.Parallel()

	endpoints := []portainer.Endpoint{
		{ID: 1, GroupID: 5},
	}
	groups := []portainer.EndpointGroup{
		{
			ID:                 5,
			TeamAccessPolicies: portainer.TeamAccessPolicies{3: {}},
		},
	}
	ctx := &RestrictedRequestContext{
		UserID: 9,
		UserMemberships: []portainer.TeamMembership{
			{TeamID: 3, UserID: 9},
		},
	}

	filtered := FilterEndpoints(endpoints, groups, ctx)

	require.Len(t, filtered, 1)
	require.Equal(t, portainer.EndpointID(1), filtered[0].ID)
}

func TestREQ_USR_07_FilterEndpointGroups_AdminSeesAll(t *testing.T) {
	t.Parallel()

	groups := []portainer.EndpointGroup{{ID: 1}, {ID: 2}}
	ctx := &RestrictedRequestContext{IsAdmin: true}

	filtered := FilterEndpointGroups(groups, ctx)

	require.Equal(t, groups, filtered)
}

func TestREQ_USR_07_FilterEndpointGroups_KeepsAuthorizedGroups(t *testing.T) {
	t.Parallel()

	groups := []portainer.EndpointGroup{
		{ID: 1, UserAccessPolicies: portainer.UserAccessPolicies{4: {}}},
		{ID: 2},
	}
	ctx := &RestrictedRequestContext{UserID: 4}

	filtered := FilterEndpointGroups(groups, ctx)

	require.Len(t, filtered, 1)
	require.Equal(t, portainer.EndpointGroupID(1), filtered[0].ID)
}

func TestGetAssociatedGroup_FindsMatchingGroup(t *testing.T) {
	t.Parallel()

	endpoint := &portainer.Endpoint{GroupID: 12}
	groups := []portainer.EndpointGroup{{ID: 11}, {ID: 12, Name: "local"}}

	got := getAssociatedGroup(endpoint, groups)

	require.NotNil(t, got)
	require.Equal(t, portainer.EndpointGroupID(12), got.ID)
	require.Equal(t, "local", got.Name)
}

func TestGetAssociatedGroup_MissingReturnsNil(t *testing.T) {
	t.Parallel()

	endpoint := &portainer.Endpoint{GroupID: 99}
	groups := []portainer.EndpointGroup{{ID: 1}}

	require.Nil(t, getAssociatedGroup(endpoint, groups))
}
