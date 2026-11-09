package source_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices/source"
	"github.com/portainer/portainer/api/datastore"
	gittypes "github.com/portainer/portainer/api/git/types"

	"github.com/stretchr/testify/require"
)

func adminCtx() source.UserContext {
	return source.InsecureNewAdminContext()
}

func standardCtx(id portainer.UserID, teams ...portainer.TeamMembership) source.UserContext {
	return source.NewUserContext(&portainer.User{ID: id, Role: portainer.StandardUserRole}, teams)
}

func gitSource(name, url string) *portainer.Source {
	return &portainer.Source{
		Name: name,
		Type: portainer.SourceTypeGit,
		Git:  &gittypes.GitSource{URL: url},
	}
}

func gitSourceWithAuth(name, url, user, pass string) *portainer.Source {
	src := gitSource(name, url)
	src.Git.Authentication = &gittypes.GitAuthentication{Username: user, Password: pass}
	return src
}

// TestREQ_GIT_02_CreateReadUpdateDeleteComposeGitSource covers the local Docker
// compose Git-source datastore path: create, read, update name/URL, delete.
func TestREQ_GIT_02_CreateReadUpdateDeleteComposeGitSource(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)
	ctx := adminCtx()

	src := gitSource("compose-repo", "https://github.com/org/compose-app.git")
	require.NoError(t, store.Source().Create(ctx, src))
	require.NotZero(t, src.ID)
	require.Equal(t, "https://github.com/org/compose-app", src.Git.URL)

	got, err := store.Source().Read(ctx, src.ID)
	require.NoError(t, err)
	require.Equal(t, "compose-repo", got.Name)
	require.Equal(t, portainer.SourceTypeGit, got.Type)

	got.Name = "compose-repo-renamed"
	got.Git.URL = "https://github.com/org/compose-app-v2.git"
	require.NoError(t, store.Source().Update(ctx, src.ID, got))

	updated, err := store.Source().Read(ctx, src.ID)
	require.NoError(t, err)
	require.Equal(t, "compose-repo-renamed", updated.Name)
	require.Equal(t, "https://github.com/org/compose-app-v2", updated.Git.URL)

	require.NoError(t, store.Source().Delete(ctx, src.ID))
	_, err = store.Source().Read(ctx, src.ID)
	require.Error(t, err)
}

func TestREQ_GIT_02_ExistsAndReadAllFiltersByAccess(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)
	admin := adminCtx()
	user2 := standardCtx(2)
	user3 := standardCtx(3, portainer.TeamMembership{TeamID: 10})

	publicSrc := gitSource("public", "https://github.com/org/public.git")
	publicSrc.Public = true
	require.NoError(t, store.Source().Create(admin, publicSrc))

	adminOnly := gitSource("admins", "https://github.com/org/admins.git")
	adminOnly.AdministratorsOnly = true
	require.NoError(t, store.Source().Create(admin, adminOnly))

	teamSrc := gitSource("team", "https://github.com/org/team.git")
	teamSrc.AdministratorsOnly = false
	teamSrc.TeamAccesses = []portainer.TeamID{10}
	require.NoError(t, store.Source().Create(admin, teamSrc))

	userSrc := gitSource("user", "https://github.com/org/user.git")
	userSrc.AdministratorsOnly = false
	userSrc.UserAccesses = []portainer.UserID{2}
	require.NoError(t, store.Source().Create(admin, userSrc))

	exists, err := store.Source().Exists(admin, publicSrc.ID)
	require.NoError(t, err)
	require.True(t, exists)

	exists, err = store.Source().Exists(user2, adminOnly.ID)
	require.NoError(t, err)
	require.True(t, exists) // Exists does not enforce access

	missing, err := store.Source().Exists(admin, portainer.SourceID(9999))
	require.NoError(t, err)
	require.False(t, missing)

	adminAll, err := store.Source().ReadAll(admin)
	require.NoError(t, err)
	require.Len(t, adminAll, 4)

	user2All, err := store.Source().ReadAll(user2)
	require.NoError(t, err)
	require.Len(t, user2All, 2) // public + user
	names := map[string]bool{}
	for _, s := range user2All {
		names[s.Name] = true
	}
	require.True(t, names["public"])
	require.True(t, names["user"])

	user3All, err := store.Source().ReadAll(user3)
	require.NoError(t, err)
	require.Len(t, user3All, 2) // public + team
	names = map[string]bool{}
	for _, s := range user3All {
		names[s.Name] = true
	}
	require.True(t, names["public"])
	require.True(t, names["team"])

	filtered, err := store.Source().ReadAll(admin, func(s portainer.Source) bool {
		return s.Name == "public"
	})
	require.NoError(t, err)
	require.Len(t, filtered, 1)
	require.Equal(t, "public", filtered[0].Name)
}

func TestREQ_GIT_02_DuplicateGitSourceRejected(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)
	admin := adminCtx()

	first := gitSourceWithAuth("one", "https://github.com/org/dup.git", "alice", "secret")
	require.NoError(t, store.Source().Create(admin, first))

	dup := gitSourceWithAuth("two", "https://github.com/org/dup.git", "alice", "secret")
	err := store.Source().Create(admin, dup)
	require.ErrorIs(t, err, source.ErrDuplicateSource)

	differentCreds := gitSourceWithAuth("three", "https://github.com/org/dup.git", "bob", "other")
	require.NoError(t, store.Source().Create(admin, differentCreds))
}

func TestREQ_GIT_02_FindOrCreateGitSourceReturnsExisting(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)
	admin := adminCtx()

	created := gitSource("existing", "https://github.com/org/reuse.git")
	created.Public = true
	require.NoError(t, store.Source().Create(admin, created))

	probe := gitSource("ignored-name", "https://github.com/org/reuse.git")
	found, err := store.Source().FindOrCreateGitSource(admin, probe)
	require.NoError(t, err)
	require.Equal(t, created.ID, found.ID)
	require.Equal(t, "existing", found.Name)
}

func TestREQ_GIT_02_FindOrCreateGitSourceCreatesWhenMissing(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)
	admin := adminCtx()

	probe := gitSource("brand-new", "https://github.com/org/brand-new.git")
	probe.Public = true
	created, err := store.Source().FindOrCreateGitSource(admin, probe)
	require.NoError(t, err)
	require.NotZero(t, created.ID)
	require.Equal(t, "brand-new", created.Name)

	got, err := store.Source().Read(admin, created.ID)
	require.NoError(t, err)
	require.Equal(t, "https://github.com/org/brand-new", got.Git.URL)
}

func TestREQ_GIT_02_FindOrCreateGitSourceGrantsAccessToCaller(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)
	admin := adminCtx()
	user := standardCtx(5)

	locked := gitSource("locked", "https://github.com/org/locked.git")
	locked.AdministratorsOnly = true
	require.NoError(t, store.Source().Create(admin, locked))

	probe := gitSource("locked", "https://github.com/org/locked.git")
	granted, err := store.Source().FindOrCreateGitSource(user, probe)
	require.NoError(t, err)
	require.Equal(t, locked.ID, granted.ID)
	require.Contains(t, granted.UserAccesses, portainer.UserID(5))
	require.False(t, granted.AdministratorsOnly)

	// caller can now read it
	got, err := store.Source().Read(user, locked.ID)
	require.NoError(t, err)
	require.Equal(t, locked.ID, got.ID)
}

func TestREQ_GIT_02_StandardUserOwnsCreatedSource(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)
	user := standardCtx(7)

	src := gitSource("mine", "https://github.com/org/mine.git")
	require.NoError(t, store.Source().Create(user, src))
	require.Equal(t, portainer.UserID(7), src.OwnerID)
	require.Contains(t, src.UserAccesses, portainer.UserID(7))
	require.False(t, src.AdministratorsOnly)

	src.Name = "mine-updated"
	require.NoError(t, store.Source().Update(user, src.ID, src))

	updated, err := store.Source().Read(user, src.ID)
	require.NoError(t, err)
	require.Equal(t, "mine-updated", updated.Name)
	require.Equal(t, portainer.UserID(7), updated.OwnerID)

	require.NoError(t, store.Source().Delete(user, src.ID))
}

func TestREQ_GIT_02_StandardUserCannotWriteOthersSource(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)
	owner := standardCtx(8)
	other := standardCtx(9)

	src := gitSource("owned", "https://github.com/org/owned.git")
	src.Public = true
	require.NoError(t, store.Source().Create(owner, src))

	// other can read public source
	got, err := store.Source().Read(other, src.ID)
	require.NoError(t, err)

	got.Name = "hijacked"
	err = store.Source().Update(other, src.ID, got)
	require.ErrorIs(t, err, source.ErrNotEnoughPermission)

	err = store.Source().Delete(other, src.ID)
	require.ErrorIs(t, err, source.ErrNotEnoughPermission)
}

func TestREQ_GIT_02_CreateRejectsNilSourceAndNilContext(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	err := store.Source().Create(nil, gitSource("x", "https://github.com/org/x.git"))
	require.ErrorIs(t, err, source.ErrInvalidUserContext)

	err = store.Source().Create(adminCtx(), nil)
	require.ErrorIs(t, err, source.ErrInvalidSource)

	_, err = store.Source().FindOrCreateGitSource(adminCtx(), nil)
	require.ErrorIs(t, err, source.ErrInvalidSource)

	_, err = store.Source().FindOrCreateGitSource(adminCtx(), &portainer.Source{Type: portainer.SourceTypeGit})
	require.ErrorIs(t, err, source.ErrInvalidSource)
}

func TestREQ_GIT_02_UpdateSelfDoesNotTriggerDuplicate(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)
	admin := adminCtx()

	src := gitSourceWithAuth("keep", "https://github.com/org/keep.git", "u", "p")
	require.NoError(t, store.Source().Create(admin, src))

	src.Name = "keep-renamed"
	require.NoError(t, store.Source().Update(admin, src.ID, src))

	got, err := store.Source().Read(admin, src.ID)
	require.NoError(t, err)
	require.Equal(t, "keep-renamed", got.Name)
}

func TestREQ_GIT_02_ReadDeniedWithoutAccess(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)
	admin := adminCtx()
	user := standardCtx(11)

	src := gitSource("secret", "https://github.com/org/secret.git")
	src.AdministratorsOnly = true
	require.NoError(t, store.Source().Create(admin, src))

	_, err := store.Source().Read(user, src.ID)
	require.ErrorIs(t, err, source.ErrNotEnoughPermission)
}

func TestREQ_GIT_02_ExistsAndReadAllRejectNilContext(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	_, err := store.Source().Exists(nil, 1)
	require.ErrorIs(t, err, source.ErrInvalidUserContext)

	_, err = store.Source().ReadAll(nil)
	require.ErrorIs(t, err, source.ErrInvalidUserContext)

	err = store.Source().Update(nil, 1, gitSource("x", "https://github.com/org/x.git"))
	require.ErrorIs(t, err, source.ErrInvalidUserContext)

	err = store.Source().Delete(nil, 1)
	require.ErrorIs(t, err, source.ErrInvalidUserContext)

	_, err = store.Source().FindOrCreateGitSource(nil, gitSource("x", "https://github.com/org/x.git"))
	require.ErrorIs(t, err, source.ErrInvalidUserContext)
}
