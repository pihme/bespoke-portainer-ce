package source

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	gittypes "github.com/portainer/portainer/api/git/types"
	"github.com/stretchr/testify/require"
)

type vFn func(new *portainer.Source, old *portainer.Source, err error)

func testUAC(
	t *testing.T,
	userContext UserContext,
	new *portainer.Source,
	old *portainer.Source,
	validationFuncs ...vFn,
) {
	t.Helper()
	err := sanitizeAccesses(userContext, new, old)
	for _, validate := range validationFuncs {
		validate(new, old, err)
	}
}

func Test_SanitizeAccesses_Admin(t *testing.T) {
	errInvalidSource := func(_, _ *portainer.Source, err error) {
		t.Helper()
		require.ErrorIs(t, err, ErrInvalidSource)
	}

	noError := func(_, _ *portainer.Source, err error) { t.Helper(); require.NoError(t, err) }
	noOwner := func(new, _ *portainer.Source, _ error) { t.Helper(); require.Zero(t, new.OwnerID) }
	emptyUsers := func(new, _ *portainer.Source, _ error) { t.Helper(); require.Empty(t, new.UserAccesses) }
	emptyTeams := func(new, _ *portainer.Source, _ error) { t.Helper(); require.Empty(t, new.TeamAccesses) }
	public := func(v bool) func(new, _ *portainer.Source, _ error) {
		return func(new, _ *portainer.Source, _ error) { t.Helper(); require.Equal(t, v, new.Public) }
	}
	adminOnly := func(v bool) func(new, _ *portainer.Source, _ error) {
		return func(new, _ *portainer.Source, _ error) { t.Helper(); require.Equal(t, v, new.AdministratorsOnly) }
	}

	adminUserContext := NewUserContext(&portainer.User{Role: portainer.AdministratorRole}, []portainer.TeamMembership{})

	test := func(new *portainer.Source, old *portainer.Source, validationFuncs ...vFn) {
		t.Helper()
		testUAC(t, adminUserContext, new, old, validationFuncs...)
	}

	test(nil, nil, errInvalidSource)
	test(&portainer.Source{}, nil, noError)
	test(&portainer.Source{Git: &gittypes.GitSource{}}, nil,
		noError, emptyUsers, emptyTeams, adminOnly(true), noOwner, public(false),
	)
	test(&portainer.Source{Git: &gittypes.GitSource{}, Public: true}, nil,
		noError, emptyUsers, emptyTeams, adminOnly(false), noOwner, public(true),
	)
	test(&portainer.Source{Git: &gittypes.GitSource{}, AdministratorsOnly: true}, nil,
		noError, emptyUsers, emptyTeams, adminOnly(true), noOwner, public(false),
	)
	test(&portainer.Source{Git: &gittypes.GitSource{}, AdministratorsOnly: true, Public: true}, nil,
		noError, emptyUsers, emptyTeams, adminOnly(true), noOwner, public(false),
	)
	test(&portainer.Source{Git: &gittypes.GitSource{}, AdministratorsOnly: true, Public: true, UserAccesses: []portainer.UserID{1, 2}}, nil,
		noError, emptyUsers, emptyTeams, adminOnly(true), noOwner, public(false),
	)
	test(&portainer.Source{Git: &gittypes.GitSource{}, UserAccesses: []portainer.UserID{3}, TeamAccesses: []portainer.TeamID{9}}, nil,
		noError, adminOnly(false), public(false),
		func(new, _ *portainer.Source, _ error) {
			t.Helper()
			require.Equal(t, []portainer.UserID{3}, new.UserAccesses)
			require.Equal(t, []portainer.TeamID{9}, new.TeamAccesses)
		},
	)
}

func Test_SanitizeAccesses_StandardUserCreate(t *testing.T) {
	user := NewUserContext(&portainer.User{ID: 12, Role: portainer.StandardUserRole}, []portainer.TeamMembership{})

	private := &portainer.Source{Git: &gittypes.GitSource{URL: "https://github.com/a/b"}, Public: false}
	require.NoError(t, sanitizeAccesses(user, private, nil))
	require.Equal(t, portainer.UserID(12), private.OwnerID)
	require.Equal(t, []portainer.UserID{12}, private.UserAccesses)
	require.Empty(t, private.TeamAccesses)
	require.False(t, private.AdministratorsOnly)

	pub := &portainer.Source{Git: &gittypes.GitSource{URL: "https://github.com/a/c"}, Public: true, UserAccesses: []portainer.UserID{99}, TeamAccesses: []portainer.TeamID{1}}
	require.NoError(t, sanitizeAccesses(user, pub, nil))
	require.Equal(t, portainer.UserID(12), pub.OwnerID)
	require.Empty(t, pub.UserAccesses)
	require.Empty(t, pub.TeamAccesses)
	require.True(t, pub.Public)
	require.False(t, pub.AdministratorsOnly)
}

func Test_SanitizeAccesses_StandardUserUpdatePreservesAccess(t *testing.T) {
	user := NewUserContext(&portainer.User{ID: 12, Role: portainer.StandardUserRole}, []portainer.TeamMembership{})
	previous := &portainer.Source{
		OwnerID:            12,
		Public:             false,
		AdministratorsOnly: false,
		UserAccesses:       []portainer.UserID{12, 15},
		TeamAccesses:       []portainer.TeamID{3},
	}
	incoming := &portainer.Source{
		OwnerID:            99,
		Public:             true,
		AdministratorsOnly: true,
		UserAccesses:       []portainer.UserID{1},
		TeamAccesses:       []portainer.TeamID{9},
		Git:                &gittypes.GitSource{URL: "https://github.com/a/d"},
	}

	require.NoError(t, sanitizeAccesses(user, incoming, previous))
	require.Equal(t, previous.OwnerID, incoming.OwnerID)
	require.Equal(t, previous.Public, incoming.Public)
	require.Equal(t, previous.AdministratorsOnly, incoming.AdministratorsOnly)
	require.Equal(t, previous.UserAccesses, incoming.UserAccesses)
	require.Equal(t, previous.TeamAccesses, incoming.TeamAccesses)
}

func Test_SanitizeGitSource(t *testing.T) {
	require.ErrorIs(t, sanitizeGitSource(nil), ErrInvalidSource)

	nonGit := &portainer.Source{Type: portainer.SourceTypeRegistry}
	require.NoError(t, sanitizeGitSource(nonGit))

	gitNil := &portainer.Source{Type: portainer.SourceTypeGit}
	require.ErrorIs(t, sanitizeGitSource(gitNil), ErrInvalidSource)

	src := &portainer.Source{
		Type: portainer.SourceTypeGit,
		Git:  &gittypes.GitSource{URL: "HTTPS://GitHub.com/Org/App.git/"},
	}
	require.NoError(t, sanitizeGitSource(src))
	require.Equal(t, "https://github.com/Org/App", src.Git.URL)
}
