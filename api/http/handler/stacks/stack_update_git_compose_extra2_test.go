package stacks

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices/source"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_STK_04_UpdateGitCompose_AdditionalFiles_Persists(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, endpoint, src := setupComposeGitStack(t, store, portainer.StackStatusActive)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.GitService = testhelpers.NewGitService(nil, "h")
	h.FileService, _ = filesystem.NewService(t.TempDir(), "")

	payload := stackGitUpdatePayload{
		SourceID:                src.ID,
		RepositoryReferenceName: "refs/heads/main",
		AdditionalFiles:         []string{"override.yml", "prod.yml"},
		ConfigFilePath:          "docker-compose.yml",
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)
	url := fmt.Sprintf("/stacks/%d/git?endpointId=%d", stack.ID, endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodPost, url, bytes.NewReader(body)))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, []string{"override.yml", "prod.yml"}, updated.AdditionalFiles)
}

func TestREQ_STK_04_UpdateGitCompose_ClearAuth_Persists(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, endpoint, _ := setupComposeGitStack(t, store, portainer.StackStatusActive)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.GitService = testhelpers.NewGitService(nil, "h")

	payload := stackGitUpdatePayload{
		RepositoryURL:            "https://example.com/compose.git",
		RepositoryReferenceName:  "refs/heads/main",
		RepositoryAuthentication: false,
		ConfigFilePath:           "docker-compose.yml",
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)
	url := fmt.Sprintf("/stacks/%d/git?endpointId=%d", stack.ID, endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodPost, url, bytes.NewReader(body)))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
}

func TestREQ_STK_04_UpdateGit_SourceWithoutGit_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, endpoint, _ := setupComposeGitStack(t, store, portainer.StackStatusActive)
	admin := source.InsecureNewAdminContext()
	bad := &portainer.Source{Type: portainer.SourceTypeRegistry} // no Git config
	require.NoError(t, store.Source().Create(admin, bad))

	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	payload := stackGitUpdatePayload{SourceID: bad.ID}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("/stacks/%d/git?endpointId=%d", stack.ID, endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodPost, url, bytes.NewReader(body)))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_04_UpdateGit_UnknownSourceID_ReturnsError(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, endpoint, _ := setupComposeGitStack(t, store, portainer.StackStatusActive)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	payload := stackGitUpdatePayload{SourceID: 999}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("/stacks/%d/git?endpointId=%d", stack.ID, endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodPost, url, bytes.NewReader(body)))
	assert.NotEqual(t, http.StatusOK, w.Code)
}

func TestREQ_STK_04_UpdateGit_MalformedJSON_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, endpoint, _ := setupComposeGitStack(t, store, portainer.StackStatusActive)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	url := fmt.Sprintf("/stacks/%d/git?endpointId=%d", stack.ID, endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodPost, url, bytes.NewReader([]byte(`{`))))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_03_Redeploy_EmptyBodyOK_UsesDefaults(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, endpoint, _ := setupComposeGitStack(t, store, portainer.StackStatusActive)
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.FileService = fileService
	h.GitService = testhelpers.NewGitService(nil, "emptybodyhash")
	h.StackDeployer = testhelpers.NewTestStackDeployer()
	h.ComposeStackManager = testhelpers.NewComposeStackManager()

	url := fmt.Sprintf("/stacks/%d/git/redeploy?endpointId=%d", stack.ID, endpoint.ID)
	req := withToken(mockCreateStackRequestWithSecurityContext(http.MethodPut, url, bytes.NewReader([]byte(`{}`))))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	require.NotNil(t, updated.CurrentDeploymentInfo)
	assert.Equal(t, "emptybodyhash", updated.CurrentDeploymentInfo.ConfigHash)
}

func TestREQ_STK_03_Redeploy_WithAuthPayload_Succeeds(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, endpoint, _ := setupComposeGitStack(t, store, portainer.StackStatusActive)
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.FileService = fileService
	h.GitService = testhelpers.NewGitService(nil, "authredeploy")
	h.StackDeployer = testhelpers.NewTestStackDeployer()
	h.ComposeStackManager = testhelpers.NewComposeStackManager()

	payload := stackGitRedeployPayload{
		RepositoryReferenceName:  "refs/heads/main",
		RepositoryAuthentication: true,
		RepositoryUsername:       "u",
		RepositoryPassword:       "p",
		PullImage:                true,
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)
	url := fmt.Sprintf("/stacks/%d/git/redeploy?endpointId=%d", stack.ID, endpoint.ID)
	req := withToken(mockCreateStackRequestWithSecurityContext(http.MethodPut, url, bytes.NewReader(body)))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	require.NotNil(t, updated.CurrentDeploymentInfo)
	assert.Equal(t, "authredeploy", updated.CurrentDeploymentInfo.ConfigHash)
}
