package update

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	portainer "github.com/portainer/portainer/api"
	gittypes "github.com/portainer/portainer/api/git/types"

	"github.com/stretchr/testify/require"
)

type stubGitService struct {
	portainer.GitService
	commitID   string
	commitErr  error
	cloneErr   error
	clonedTo   string
	cloneCalls int
	user, pass string
}

func (s *stubGitService) LatestCommitID(
	_ context.Context, _, _, username, password string, _ bool,
) (string, error) {
	s.user, s.pass = username, password
	return s.commitID, s.commitErr
}

func (s *stubGitService) CloneRepository(
	_ context.Context, destination, _, _, username, password string, _ bool,
) error {
	s.cloneCalls++
	s.clonedTo = destination
	s.user, s.pass = username, password
	if s.cloneErr != nil {
		return s.cloneErr
	}
	return os.MkdirAll(destination, 0o755)
}

func TestREQ_STK_03_UpdateGitObject_NilConfig(t *testing.T) {
	t.Parallel()
	changed, hash, err := UpdateGitObject(t.Context(), &stubGitService{}, "stack-1", nil, false, t.TempDir())
	require.NoError(t, err)
	require.False(t, changed)
	require.Empty(t, hash)
}

func TestREQ_STK_03_UpdateGitObject_UnchangedHash(t *testing.T) {
	t.Parallel()
	svc := &stubGitService{commitID: "AbC123"}
	cfg := &gittypes.RepoConfig{
		URL:           "https://example.com/r.git",
		ReferenceName: "refs/heads/main",
		ConfigHash:    "abc123",
	}
	changed, hash, err := UpdateGitObject(t.Context(), svc, "stack-1", cfg, false, t.TempDir())
	require.NoError(t, err)
	require.False(t, changed)
	require.Equal(t, "AbC123", hash)
	require.Equal(t, 0, svc.cloneCalls)
}

func TestREQ_STK_03_UpdateGitObject_CloneWithoutVersionFolder(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	svc := &stubGitService{commitID: "newhash"}
	cfg := &gittypes.RepoConfig{
		URL:           "https://example.com/r.git",
		ReferenceName: "refs/heads/main",
		ConfigHash:    "oldhash",
		Authentication: &gittypes.GitAuthentication{
			Username: "u",
			Password: "p",
		},
	}
	changed, hash, err := UpdateGitObject(t.Context(), svc, "stack-1", cfg, false, root)
	require.NoError(t, err)
	require.True(t, changed)
	require.Equal(t, "newhash", hash)
	require.Equal(t, root, svc.clonedTo)
	require.Equal(t, "u", svc.user)
	require.Equal(t, "p", svc.pass)
	require.DirExists(t, root)
}

func TestREQ_STK_03_UpdateGitObject_CloneWithVersionFolder(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	svc := &stubGitService{commitID: "v2"}
	cfg := &gittypes.RepoConfig{
		URL:           "https://example.com/r.git",
		ReferenceName: "refs/heads/main",
		ConfigHash:    "v1",
	}
	changed, hash, err := UpdateGitObject(t.Context(), svc, "tpl-1", cfg, true, root)
	require.NoError(t, err)
	require.True(t, changed)
	require.Equal(t, "v2", hash)
	require.Equal(t, filepath.Join(root, "v2"), svc.clonedTo)
	require.DirExists(t, filepath.Join(root, "v2"))
}

func TestREQ_STK_03_UpdateGitObject_LatestCommitError(t *testing.T) {
	t.Parallel()
	svc := &stubGitService{commitErr: errors.New("fetch failed")}
	cfg := &gittypes.RepoConfig{URL: "https://example.com/r.git", ConfigHash: "x"}
	changed, hash, err := UpdateGitObject(t.Context(), svc, "stack-1", cfg, false, t.TempDir())
	require.Error(t, err)
	require.Contains(t, err.Error(), "failed to fetch latest commit id")
	require.False(t, changed)
	require.Empty(t, hash)
}

func TestREQ_STK_03_UpdateGitObject_CloneErrorCleansVersionFolder(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	svc := &stubGitService{
		commitID: "bad",
		cloneErr: errors.New("clone boom"),
	}
	cfg := &gittypes.RepoConfig{URL: "https://example.com/r.git", ConfigHash: "old"}
	changed, hash, err := UpdateGitObject(t.Context(), svc, "stack-1", cfg, true, root)
	require.Error(t, err)
	require.Contains(t, err.Error(), "failed to do a fresh clone")
	require.False(t, changed)
	require.Empty(t, hash)
	require.NoDirExists(t, filepath.Join(root, "bad"))
}

func TestREQ_STK_03_UpdateGitObject_CloneErrorWithoutVersionFolder(t *testing.T) {
	t.Parallel()
	svc := &stubGitService{commitID: "n", cloneErr: errors.New("clone boom")}
	cfg := &gittypes.RepoConfig{URL: "https://example.com/r.git", ConfigHash: "o"}
	changed, _, err := UpdateGitObject(t.Context(), svc, "stack-1", cfg, false, t.TempDir())
	require.Error(t, err)
	require.False(t, changed)
}

func TestTmpClonesFromContext(t *testing.T) {
	t.Parallel()
	require.Nil(t, TmpClonesFromContext(t.Context()))

	ctx, tc := WithTmpClones(t.Context())
	defer tc.Close()
	require.Same(t, tc, TmpClonesFromContext(ctx))
}

func TestTmpClonesCloseNil(t *testing.T) {
	t.Parallel()
	var nilClones *TmpClones
	require.NotPanics(t, func() { nilClones.Close() })
}

func TestREQ_DED_01_ValidateAutoUpdateSettings_NilAndEmpty(t *testing.T) {
	t.Parallel()
	require.NoError(t, ValidateAutoUpdateSettings(nil))
	require.Error(t, ValidateAutoUpdateSettings(&portainer.AutoUpdateSettings{}))
}
