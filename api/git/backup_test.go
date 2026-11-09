package git

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	portainer "github.com/portainer/portainer/api"
	gittypes "github.com/portainer/portainer/api/git/types"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

// stubGitService implements portainer.GitService for CloneWithBackup tests.
type stubGitService struct {
	portainer.GitService

	cloneErr     error
	cloneCalled  int
	lastTLSSkip  bool
	lastURL      string
	lastRef      string
	writeCompose bool
	composeBody  string
}

func (s *stubGitService) CloneRepository(
	_ context.Context,
	destination, repositoryURL, referenceName, _, _ string,
	tlsSkipVerify bool,
) error {
	s.cloneCalled++
	s.lastTLSSkip = tlsSkipVerify
	s.lastURL = repositoryURL
	s.lastRef = referenceName
	if s.cloneErr != nil {
		return s.cloneErr
	}
	if err := os.MkdirAll(destination, 0o755); err != nil {
		return err
	}
	if s.writeCompose {
		body := s.composeBody
		if body == "" {
			body = "services:\n  web:\n    image: nginx\n"
		}
		return os.WriteFile(filepath.Join(destination, "docker-compose.yml"), []byte(body), 0o644)
	}
	return nil
}

func (s *stubGitService) LatestCommitID(context.Context, string, string, string, string, bool) (string, error) {
	return "", nil
}

func (s *stubGitService) ListRefs(context.Context, string, string, string, bool, bool) ([]string, error) {
	return nil, nil
}

func (s *stubGitService) ListFiles(context.Context, string, string, string, string, bool, bool, []string, bool) ([]string, error) {
	return nil, nil
}

// stubFileService implements only RemoveDirectory for CloneWithBackup cleanup.
type stubFileService struct {
	portainer.FileService

	removeErr    error
	removedPaths []string
	removeCalled int
}

func (s *stubFileService) RemoveDirectory(directoryPath string) error {
	s.removeCalled++
	s.removedPaths = append(s.removedPaths, directoryPath)
	if s.removeErr != nil {
		return s.removeErr
	}
	return os.RemoveAll(directoryPath)
}

func TestREQ_STK_04_CloneWithBackup_SucceedsAndCleanRemovesBackup(t *testing.T) {
	t.Parallel()

	projectPath := filepath.Join(t.TempDir(), "stack")
	require.NoError(t, os.MkdirAll(projectPath, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(projectPath, "old.yml"), []byte("old"), 0o644))

	gitSvc := &stubGitService{writeCompose: true, composeBody: "services:\n  app:\n    image: alpine\n"}
	fileSvc := &stubFileService{}

	clean, err := CloneWithBackup(t.Context(), gitSvc, fileSvc, CloneOptions{
		ProjectPath:   projectPath,
		URL:           "file:///tmp/repo.git",
		ReferenceName: "refs/heads/main",
		TLSSkipVerify: true,
	})
	require.NoError(t, err)
	require.Equal(t, 1, gitSvc.cloneCalled)
	require.True(t, gitSvc.lastTLSSkip)
	require.Equal(t, "refs/heads/main", gitSvc.lastRef)
	require.FileExists(t, filepath.Join(projectPath, "docker-compose.yml"))
	require.NoFileExists(t, filepath.Join(projectPath, "old.yml"))
	require.DirExists(t, projectPath+"-old")

	clean()
	require.Equal(t, 1, fileSvc.removeCalled)
	require.NoDirExists(t, projectPath+"-old")
}

func TestREQ_STK_04_CloneWithBackup_CloneFailureRestoresProject(t *testing.T) {
	t.Parallel()

	projectPath := filepath.Join(t.TempDir(), "stack")
	require.NoError(t, os.MkdirAll(projectPath, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(projectPath, "keep.yml"), []byte("keep"), 0o644))

	cloneErr := errors.New("network unreachable")
	gitSvc := &stubGitService{cloneErr: cloneErr}
	fileSvc := &stubFileService{}

	clean, err := CloneWithBackup(t.Context(), gitSvc, fileSvc, CloneOptions{
		ProjectPath: projectPath,
		URL:         "https://example.com/repo.git",
	})
	require.Error(t, err)
	require.ErrorContains(t, err, "Unable to clone git repository")
	require.ErrorIs(t, err, cloneErr)
	require.FileExists(t, filepath.Join(projectPath, "keep.yml"))
	require.NoDirExists(t, projectPath+"-old")

	// cleanUp was reset to false after clone failure, so clean is a no-op
	clean()
	require.Equal(t, 0, fileSvc.removeCalled)
}

func TestREQ_STK_04_CloneWithBackup_AuthFailureWrapsCredentialError(t *testing.T) {
	t.Parallel()

	projectPath := filepath.Join(t.TempDir(), "stack")
	require.NoError(t, os.MkdirAll(projectPath, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(projectPath, "compose.yml"), []byte("x"), 0o644))

	gitSvc := &stubGitService{cloneErr: gittypes.ErrAuthenticationFailure}
	fileSvc := &stubFileService{}

	_, err := CloneWithBackup(t.Context(), gitSvc, fileSvc, CloneOptions{
		ProjectPath: projectPath,
		URL:         "https://example.com/private.git",
		Username:    "user",
		Password:    "bad",
	})
	require.Error(t, err)
	require.ErrorIs(t, err, gittypes.ErrAuthenticationFailure)
	require.ErrorContains(t, err, ErrInvalidGitCredential.Error())
	require.FileExists(t, filepath.Join(projectPath, "compose.yml"))
}

func TestREQ_STK_04_CloneWithBackup_MissingProjectReturnsMoveError(t *testing.T) {
	t.Parallel()

	projectPath := filepath.Join(t.TempDir(), "does-not-exist")
	gitSvc := &stubGitService{}
	fileSvc := &stubFileService{}

	clean, err := CloneWithBackup(t.Context(), gitSvc, fileSvc, CloneOptions{
		ProjectPath: projectPath,
		URL:         "https://example.com/repo.git",
	})
	require.Error(t, err)
	require.ErrorContains(t, err, "Unable to move git repository directory")
	require.Equal(t, 0, gitSvc.cloneCalled)

	clean()
	require.Equal(t, 0, fileSvc.removeCalled)
}

func TestREQ_STK_04_CloneWithBackup_CleanIgnoresRemoveError(t *testing.T) {
	t.Parallel()

	projectPath := filepath.Join(t.TempDir(), "stack")
	require.NoError(t, os.MkdirAll(projectPath, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(projectPath, "a.yml"), []byte("a"), 0o644))

	gitSvc := &stubGitService{writeCompose: true}
	fileSvc := &stubFileService{removeErr: errors.New("remove failed")}

	clean, err := CloneWithBackup(t.Context(), gitSvc, fileSvc, CloneOptions{
		ProjectPath: projectPath,
		URL:         "file:///tmp/repo.git",
	})
	require.NoError(t, err)

	// Should not panic; remove error is only logged.
	clean()
	require.Equal(t, 1, fileSvc.removeCalled)
	require.DirExists(t, projectPath+"-old")
}
