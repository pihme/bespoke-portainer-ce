package source

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	gittypes "github.com/portainer/portainer/api/git/types"

	"github.com/stretchr/testify/require"
)

func Test_NormalizedGitSource_Equal(t *testing.T) {
	a := &normalizedGitSource{url: "https://github.com/a/b", username: "u", password: "p"}
	b := &normalizedGitSource{url: "https://github.com/a/b", username: "u", password: "p"}
	c := &normalizedGitSource{url: "https://github.com/a/b", username: "u", password: "other"}

	require.True(t, a.Equal(b))
	require.False(t, a.Equal(c))
	require.False(t, a.Equal(nil))
	require.False(t, (*normalizedGitSource)(nil).Equal(b))
	require.False(t, (*normalizedGitSource)(nil).Equal(nil))
}

func Test_NormalizeGitSource_WithAndWithoutAuth(t *testing.T) {
	noAuth, err := normalizeGitSource(&portainer.Source{
		Type: portainer.SourceTypeGit,
		Git:  &gittypes.GitSource{URL: "HTTPS://GitHub.com/Org/Repo.git/"},
	})
	require.NoError(t, err)
	require.Equal(t, "https://github.com/Org/Repo", noAuth.url)
	require.Empty(t, noAuth.username)
	require.Empty(t, noAuth.password)

	withAuth, err := normalizeGitSource(&portainer.Source{
		Type: portainer.SourceTypeGit,
		Git: &gittypes.GitSource{
			URL:            "https://github.com/org/repo",
			Authentication: &gittypes.GitAuthentication{Username: "alice", Password: "secret"},
		},
	})
	require.NoError(t, err)
	require.Equal(t, "alice", withAuth.username)
	require.Equal(t, "secret", withAuth.password)
}

func Test_NormalizeGitSource_RejectsInvalid(t *testing.T) {
	_, err := normalizeGitSource(nil)
	require.ErrorIs(t, err, ErrInvalidSource)

	_, err = normalizeGitSource(&portainer.Source{Type: portainer.SourceTypeHelm})
	require.ErrorIs(t, err, ErrInvalidSource)

	_, err = normalizeGitSource(&portainer.Source{Type: portainer.SourceTypeGit})
	require.ErrorIs(t, err, ErrInvalidSource)
}
