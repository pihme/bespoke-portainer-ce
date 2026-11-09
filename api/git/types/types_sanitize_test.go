package gittypes

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRepoName(t *testing.T) {
	t.Parallel()
	require.Equal(t, "app-config", RepoName("https://github.com/org/app-config.git"))
	require.Equal(t, "repo", RepoName("https://github.com/org/repo"))
}

func TestSanitizeURL(t *testing.T) {
	t.Parallel()
	require.Equal(t, "https://github.com/org/repo.git", SanitizeURL("https://user:pass@github.com/org/repo.git"))
	require.Equal(t, "https://github.com/org/repo", SanitizeURL("https://github.com/org/repo"))
	require.Equal(t, "://bad", SanitizeURL("://bad")) // parse error returns input
}

func TestSanitizeRepoConfig(t *testing.T) {
	t.Parallel()
	require.Nil(t, SanitizeRepoConfig(nil))

	got := SanitizeRepoConfig(&RepoConfig{
		URL: "https://user:secret@github.com/org/repo.git",
		Authentication: &GitAuthentication{
			Username: "user",
			Password: "secret",
		},
	})
	require.Equal(t, "https://github.com/org/repo.git", got.URL)
	require.Equal(t, "user", got.Authentication.Username)
	require.Empty(t, got.Authentication.Password)

	plain := SanitizeRepoConfig(&RepoConfig{URL: "https://github.com/org/repo"})
	require.Equal(t, "https://github.com/org/repo", plain.URL)
	require.Nil(t, plain.Authentication)
}

func TestSanitizeGitSourceAndToRepoConfig(t *testing.T) {
	t.Parallel()
	require.Nil(t, SanitizeGitSource(nil))

	src := &GitSource{
		URL:           "https://user:pass@github.com/org/app.git",
		TLSSkipVerify: true,
		Authentication: &GitAuthentication{
			Username: "user",
			Password: "pass",
		},
	}
	sanitized := SanitizeGitSource(src)
	require.Equal(t, "https://github.com/org/app.git", sanitized.URL)
	require.True(t, sanitized.TLSSkipVerify)
	require.Empty(t, sanitized.Authentication.Password)
	require.Equal(t, "pass", src.Authentication.Password) // original unchanged

	cfg := src.ToRepoConfig()
	require.Equal(t, src.URL, cfg.URL)
	require.True(t, cfg.TLSSkipVerify)
	require.Equal(t, src.Authentication, cfg.Authentication)
}

func TestNormalizeURLParseError(t *testing.T) {
	t.Parallel()
	_, err := NormalizeURL("http://[::1")
	require.Error(t, err)
}
