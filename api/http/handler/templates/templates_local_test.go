package templates

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/pkg/featureflags"
	libclient "github.com/portainer/portainer/pkg/libhttp/client"

	"github.com/pkg/errors"
	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Phase C KEEP tests for listing/fetching app templates (REQ-TPL-01, REQ-TPL-02).

type stubGitService struct {
	portainer.GitService
	cloneErr error
	clonedTo string
}

func (g *stubGitService) CloneRepository(_ context.Context, destination, repositoryURL, _, _, _ string, _ bool) error {
	g.clonedTo = destination
	if g.cloneErr != nil {
		return g.cloneErr
	}
	if err := os.MkdirAll(destination, 0o755); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(destination, "docker-compose.yml"), []byte("services:\n  web:\n    image: nginx\n"), 0o600)
}

type failingTempPathFileService struct {
	*filesystem.Service
	tempErr error
}

func (f *failingTempPathFileService) GetTemporaryPath() (string, error) {
	if f.tempErr != nil {
		return "", f.tempErr
	}
	return f.Service.GetTemporaryPath()
}

type failingContentFileService struct {
	*filesystem.Service
	contentErr error
}

func (f *failingContentFileService) GetFileContent(projectPath, fileName string) ([]byte, error) {
	if f.contentErr != nil {
		return nil, f.contentErr
	}
	return f.Service.GetFileContent(projectPath, fileName)
}

func templatesJSON() []byte {
	payload := map[string]any{
		"version": "3",
		"templates": []map[string]any{
			{
				"type":        int(portainer.ContainerTemplate),
				"title":       "Nginx",
				"description": "web server",
				"image":       "nginx:latest",
			},
			{
				"type":        int(portainer.ComposeStackTemplate),
				"title":       "Compose inline",
				"description": "inline stack",
				"stackFile":   "version: '3'\nservices:\n  app:\n    image: alpine\n",
			},
			{
				"type":        int(portainer.ComposeStackTemplate),
				"title":       "Compose git",
				"description": "git stack",
				"repository": map[string]string{
					"url":       "https://example.com/repo.git",
					"stackfile": "docker-compose.yml",
				},
			},
			{
				"type":        int(portainer.ComposeStackTemplate),
				"title":       "Compose broken",
				"description": "missing repo",
				"repository":  map[string]string{},
			},
		},
	}
	b, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}
	return b
}

func startTemplatesServer(t *testing.T, body []byte, status int) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(status)
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func setupTemplatesHandler(t *testing.T, templatesURL string) (*Handler, *datastore.Store, *filesystem.Service) {
	t.Helper()
	_, store := datastore.MustNewTestStore(t, true, true)
	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	settings.TemplatesURL = templatesURL
	require.NoError(t, store.Settings().UpdateSettings(settings))

	fs, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)

	h := NewHandler(testhelpers.NewTestRequestBouncer())
	h.DataStore = store
	h.FileService = fs
	h.GitService = &stubGitService{}
	return h, store, fs
}

func TestREQ_TPL_01_TemplateList_FromCustomURL(t *testing.T) {
	t.Parallel()

	srv := startTemplatesServer(t, templatesJSON(), http.StatusOK)
	h, _, _ := setupTemplatesHandler(t, srv.URL)

	req := httptest.NewRequest(http.MethodGet, "/templates", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var resp listResponse
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
	require.Len(t, resp.Templates, 4)
	assert.Equal(t, portainer.TemplateID(1), resp.Templates[0].ID)
	assert.Equal(t, "Nginx", resp.Templates[0].Title)
	assert.Equal(t, portainer.TemplateID(2), resp.Templates[1].ID)
}

func TestREQ_TPL_02_FetchTemplates_EmptyURLUsesDefaultDisabledPath(t *testing.T) {
	featureflags.Parse([]string{string(libclient.DisableExternalRequests)}, []featureflags.Feature{libclient.DisableExternalRequests})
	t.Cleanup(func() {
		featureflags.Parse(nil, []featureflags.Feature{libclient.DisableExternalRequests})
	})

	_, store := datastore.MustNewTestStore(t, true, true)
	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	settings.TemplatesURL = ""
	require.NoError(t, store.Settings().UpdateSettings(settings))

	h := NewHandler(testhelpers.NewTestRequestBouncer())
	h.DataStore = store

	req := httptest.NewRequest(http.MethodGet, "/templates", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, "null", rr.Body.String())
}

func TestREQ_TPL_01_FetchTemplates_NetworkAndParseErrors(t *testing.T) {
	t.Parallel()

	t.Run("bad url", func(t *testing.T) {
		h, _, _ := setupTemplatesHandler(t, "http://127.0.0.1:1/nope")
		req := httptest.NewRequest(http.MethodGet, "/templates", nil)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusInternalServerError, rr.Code)
	})

	t.Run("invalid json", func(t *testing.T) {
		srv := startTemplatesServer(t, []byte("not-json"), http.StatusOK)
		h, _, _ := setupTemplatesHandler(t, srv.URL)
		req := httptest.NewRequest(http.MethodGet, "/templates", nil)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusInternalServerError, rr.Code)
	})
}

func TestREQ_TPL_01_TemplateFile_InlineStackFile(t *testing.T) {
	t.Parallel()

	srv := startTemplatesServer(t, templatesJSON(), http.StatusOK)
	h, _, _ := setupTemplatesHandler(t, srv.URL)

	req := httptest.NewRequest(http.MethodPost, "/templates/2/file", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var resp fileResponse
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
	assert.Contains(t, resp.FileContent, "image: alpine")
}

func TestREQ_TPL_01_TemplateFile_FromGitRepository(t *testing.T) {
	t.Parallel()

	srv := startTemplatesServer(t, templatesJSON(), http.StatusOK)
	h, _, _ := setupTemplatesHandler(t, srv.URL)

	req := httptest.NewRequest(http.MethodPost, "/templates/3/file", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var resp fileResponse
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
	assert.Contains(t, resp.FileContent, "image: nginx")
}

func TestREQ_TPL_01_TemplateFile_ValidationErrors(t *testing.T) {
	t.Parallel()

	srv := startTemplatesServer(t, templatesJSON(), http.StatusOK)
	h, _, _ := setupTemplatesHandler(t, srv.URL)

	t.Run("invalid id", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/templates/abc/file", nil)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("not found", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/templates/99/file", nil)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusNotFound, rr.Code)
	})

	t.Run("container type rejected", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/templates/1/file", nil)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("missing repository config", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/templates/4/file", nil)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})
}

func TestREQ_TPL_01_TemplateFile_GitAndFSFailures(t *testing.T) {
	t.Parallel()

	srv := startTemplatesServer(t, templatesJSON(), http.StatusOK)

	t.Run("temp path failure", func(t *testing.T) {
		h, _, fs := setupTemplatesHandler(t, srv.URL)
		h.FileService = &failingTempPathFileService{Service: fs, tempErr: assert.AnError}
		req := httptest.NewRequest(http.MethodPost, "/templates/3/file", nil)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusInternalServerError, rr.Code)
	})

	t.Run("clone failure", func(t *testing.T) {
		h, _, _ := setupTemplatesHandler(t, srv.URL)
		h.GitService = &stubGitService{cloneErr: errors.New("clone failed")}
		req := httptest.NewRequest(http.MethodPost, "/templates/3/file", nil)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusInternalServerError, rr.Code)
	})

	t.Run("file content failure", func(t *testing.T) {
		h, _, fs := setupTemplatesHandler(t, srv.URL)
		h.FileService = &failingContentFileService{Service: fs, contentErr: assert.AnError}
		h.GitService = &stubGitService{}
		req := httptest.NewRequest(http.MethodPost, "/templates/3/file", nil)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusInternalServerError, rr.Code)
	})
}

func TestCleanUp_RemoveDirectoryErrorIsLogged(t *testing.T) {
	t.Parallel()

	fs, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h := NewHandler(testhelpers.NewTestRequestBouncer())
	h.FileService = fs
	// Missing path should only log, not panic.
	h.cleanUp(filepath.Join(t.TempDir(), "does-not-exist"))
}
