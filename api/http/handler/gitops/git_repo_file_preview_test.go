package gitops

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices/source"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	gittypes "github.com/portainer/portainer/api/git/types"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"

	"github.com/stretchr/testify/require"
)

type cloneGit struct {
	err      error
	fileName string
	content  string
}

func (g *cloneGit) CloneRepository(_ context.Context, destination, _, _, _, _ string, _ bool) error {
	if g.err != nil {
		return g.err
	}
	name := g.fileName
	if name == "" {
		name = "docker-compose.yml"
	}
	content := g.content
	if content == "" {
		content = "services:\n  web:\n    image: nginx\n"
	}
	if err := os.MkdirAll(destination, 0o700); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(destination, name), []byte(content), 0o600)
}

func (g *cloneGit) LatestCommitID(context.Context, string, string, string, string, bool) (string, error) {
	return "abc", nil
}
func (g *cloneGit) ListRefs(context.Context, string, string, string, bool, bool) ([]string, error) {
	return nil, nil
}
func (g *cloneGit) ListFiles(context.Context, string, string, string, string, bool, bool, []string, bool) ([]string, error) {
	return nil, nil
}

func newGitopsHandler(t *testing.T, git portainer.GitService) (*Handler, *datastore.Store, *portainer.User) {
	t.Helper()
	_, store := datastore.MustNewTestStore(t, true, true)
	admin := &portainer.User{Username: "admin", Role: portainer.AdministratorRole}
	require.NoError(t, store.User().Create(admin))

	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)

	if git == nil {
		git = &cloneGit{}
	}
	h := NewHandler(testhelpers.NewTestRequestBouncer(), store, git, fileService, nil, nil)
	return h, store, admin
}

func previewRequest(t *testing.T, h *Handler, user *portainer.User, payload any) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(payload)
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/gitops/repo/file/preview", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		IsAdmin: true,
		UserID:  user.ID,
		User:    user,
	}))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

func TestRepositoryFilePreviewPayload_Validate(t *testing.T) {
	t.Parallel()

	p := &repositoryFilePreviewPayload{TargetFile: "docker-compose.yml", Repository: "https://example.com/r.git"}
	require.NoError(t, p.Validate(nil))
	require.Equal(t, "refs/heads/main", p.Reference)

	p2 := &repositoryFilePreviewPayload{SourceID: 3, TargetFile: "a.yml", Reference: "refs/heads/dev"}
	require.NoError(t, p2.Validate(nil))
	require.Equal(t, "refs/heads/dev", p2.Reference)

	require.Error(t, (&repositoryFilePreviewPayload{TargetFile: "a.yml"}).Validate(nil))
	require.Error(t, (&repositoryFilePreviewPayload{Repository: "", TargetFile: "a.yml"}).Validate(nil))
	require.Error(t, (&repositoryFilePreviewPayload{Repository: "https://example.com/r.git"}).Validate(nil))
	require.Error(t, (&repositoryFilePreviewPayload{Repository: "://bad", TargetFile: "a.yml"}).Validate(nil))
}

func TestGitOperationRepoFilePreview_InlineRepository_OK(t *testing.T) {
	t.Parallel()
	h, _, admin := newGitopsHandler(t, &cloneGit{content: "version: '3'\n"})
	rr := previewRequest(t, h, admin, repositoryFilePreviewPayload{
		Repository: "https://example.com/compose.git",
		TargetFile: "docker-compose.yml",
	})
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	var got fileResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	require.Contains(t, got.FileContent, "version:")
}

func TestGitOperationRepoFilePreview_ViaSourceID_WithAuth_OK(t *testing.T) {
	t.Parallel()
	h, store, admin := newGitopsHandler(t, &cloneGit{fileName: "stack.yml", content: "services: {}\n"})

	adminCtx := source.InsecureNewAdminContext()
	src := &portainer.Source{
		Type: portainer.SourceTypeGit,
		Git: &gittypes.GitSource{
			URL: "https://example.com/src.git",
			Authentication: &gittypes.GitAuthentication{
				Username: "u",
				Password: "p",
			},
			TLSSkipVerify: true,
		},
	}
	require.NoError(t, store.Source().Create(adminCtx, src))

	rr := previewRequest(t, h, admin, repositoryFilePreviewPayload{
		SourceID:   src.ID,
		TargetFile: "stack.yml",
		Reference:  "refs/heads/main",
	})
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	var got fileResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	require.Contains(t, got.FileContent, "services:")
}

func TestGitOperationRepoFilePreview_SourceWithoutAuth_OK(t *testing.T) {
	t.Parallel()
	h, store, admin := newGitopsHandler(t, &cloneGit{})

	adminCtx := source.InsecureNewAdminContext()
	src := &portainer.Source{
		Type: portainer.SourceTypeGit,
		Git:  &gittypes.GitSource{URL: "https://example.com/public.git"},
	}
	require.NoError(t, store.Source().Create(adminCtx, src))

	rr := previewRequest(t, h, admin, repositoryFilePreviewPayload{
		SourceID:   src.ID,
		TargetFile: "docker-compose.yml",
	})
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
}

func TestGitOperationRepoFilePreview_SourceNotFound(t *testing.T) {
	t.Parallel()
	h, _, admin := newGitopsHandler(t, &cloneGit{})
	rr := previewRequest(t, h, admin, repositoryFilePreviewPayload{
		SourceID:   999,
		TargetFile: "docker-compose.yml",
	})
	require.Equal(t, http.StatusNotFound, rr.Code)
}

func TestGitOperationRepoFilePreview_InvalidPayload(t *testing.T) {
	t.Parallel()
	h, _, admin := newGitopsHandler(t, &cloneGit{})
	rr := previewRequest(t, h, admin, map[string]any{"targetFile": ""})
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestGitOperationRepoFilePreview_AuthFailure(t *testing.T) {
	t.Parallel()
	h, _, admin := newGitopsHandler(t, &cloneGit{err: gittypes.ErrAuthenticationFailure})
	rr := previewRequest(t, h, admin, repositoryFilePreviewPayload{
		Repository: "https://example.com/r.git",
		TargetFile: "docker-compose.yml",
	})
	require.Equal(t, http.StatusBadRequest, rr.Code)
	require.Contains(t, rr.Body.String(), "Invalid git credential")
}

func TestGitOperationRepoFilePreview_CloneError(t *testing.T) {
	t.Parallel()
	h, _, admin := newGitopsHandler(t, &cloneGit{err: errors.New("network down")})
	rr := previewRequest(t, h, admin, repositoryFilePreviewPayload{
		Repository: "https://example.com/r.git",
		TargetFile: "docker-compose.yml",
	})
	require.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestGitOperationRepoFilePreview_MissingFile(t *testing.T) {
	t.Parallel()
	h, _, admin := newGitopsHandler(t, &cloneGit{fileName: "other.yml"})
	rr := previewRequest(t, h, admin, repositoryFilePreviewPayload{
		Repository: "https://example.com/r.git",
		TargetFile: "docker-compose.yml",
	})
	require.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestGitOperationRepoFilePreview_MissingSecurityContext(t *testing.T) {
	t.Parallel()
	h, _, _ := newGitopsHandler(t, &cloneGit{})
	body, err := json.Marshal(repositoryFilePreviewPayload{
		Repository: "https://example.com/r.git",
		TargetFile: "docker-compose.yml",
	})
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/gitops/repo/file/preview", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestNewHandler_RegistersPreviewRoute(t *testing.T) {
	t.Parallel()
	h, _, _ := newGitopsHandler(t, testhelpers.NewGitService(nil, "x"))
	require.NotNil(t, h)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/gitops/repo/file/preview", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(rr, req)
	require.NotEqual(t, http.StatusNotFound, rr.Code)
}
