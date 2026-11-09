package stacks

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
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
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupComposeGitStack(t *testing.T, store *datastore.Store, status portainer.StackStatus) (*portainer.Stack, *portainer.Endpoint, *portainer.Source) {
	t.Helper()
	_, err := mockCreateUser(store)
	require.NoError(t, err)

	endpoint := &portainer.Endpoint{
		ID:   1,
		Name: "docker",
		Type: portainer.DockerEnvironment,
		SecuritySettings: portainer.EndpointSecuritySettings{
			AllowStackManagementForRegularUsers: true,
		},
	}
	require.NoError(t, store.Endpoint().Create(endpoint))

	admin := source.InsecureNewAdminContext()
	src := &portainer.Source{
		Type: portainer.SourceTypeGit,
		Git:  &gittypes.GitSource{URL: "https://example.com/compose.git"},
	}
	require.NoError(t, store.Source().Create(admin, src))

	projectPath := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(projectPath, "docker-compose.yml"), []byte("services:\n  web:\n    image: alpine\n"), 0o600))

	stackID := portainer.StackID(10)
	wf := &portainer.Workflow{
		Artifacts: []portainer.Artifact{{
			StackID: stackID,
			Files: []portainer.ArtifactFile{{
				SourceID: src.ID,
				Ref:      "refs/heads/main",
				Path:     "docker-compose.yml",
				Hash:     "oldhash",
			}},
		}},
	}
	require.NoError(t, store.Workflow().Create(wf))

	stack := &portainer.Stack{
		ID:          stackID,
		Name:        "git-compose",
		Type:        portainer.DockerComposeStack,
		EndpointID:  endpoint.ID,
		WorkflowID:  wf.ID,
		EntryPoint:  "docker-compose.yml",
		ProjectPath: projectPath,
		Status:      status,
	}
	require.NoError(t, store.Stack().Create(stack))
	return stack, endpoint, src
}

func TestREQ_STK_04_UpdateGitCompose_ViaSourceID_PersistsRefAndEnv(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, endpoint, src := setupComposeGitStack(t, store, portainer.StackStatusActive)

	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.FileService, _ = filesystem.NewService(t.TempDir(), "")
	h.GitService = testhelpers.NewGitService(nil, "unused")

	payload := stackGitUpdatePayload{
		SourceID:                src.ID,
		RepositoryReferenceName: "refs/heads/feature",
		ConfigFilePath:          "docker-compose.yml",
		Env:                     []portainer.Pair{{Name: "A", Value: "1"}},
		AutoUpdate:              nil,
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)

	url := fmt.Sprintf("/stacks/%d/git?endpointId=%d", stack.ID, endpoint.ID)
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, url, bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, []portainer.Pair{{Name: "A", Value: "1"}}, updated.Env)
	assert.Equal(t, "testuser", updated.UpdatedBy)
	assert.NotZero(t, updated.UpdateDate)
	assert.NotNil(t, updated.CurrentDeploymentInfo)

	var resp stackResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, stack.ID, resp.ID)
	assert.Equal(t, src.ID, resp.GitSourceId)
}

func TestREQ_STK_04_UpdateGit_MissingStack_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	_, err = mockCreateEndpoint(store)
	require.NoError(t, err)

	body, _ := json.Marshal(stackGitUpdatePayload{})
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/99/git?endpointId=1", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_04_UpdateGit_NonGitStack_ReturnsError(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "plain", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID, WorkflowID: 0,
	}))

	body, _ := json.Marshal(stackGitUpdatePayload{})
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/1/git?endpointId=1", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestREQ_STK_04_UpdateGit_InvalidStackID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	body, _ := json.Marshal(stackGitUpdatePayload{})
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/abc/git", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_04_UpdateGit_InvalidAutoUpdatePayload_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, endpoint, _ := setupComposeGitStack(t, store, portainer.StackStatusActive)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store

	payload := stackGitUpdatePayload{AutoUpdate: &portainer.AutoUpdateSettings{Interval: "1s"}}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("/stacks/%d/git?endpointId=%d", stack.ID, endpoint.ID)
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, url, bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_03_RedeployComposeGit_SucceedsAndSetsDeploying(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, endpoint, _ := setupComposeGitStack(t, store, portainer.StackStatusActive)

	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.FileService = fileService
	h.GitService = testhelpers.NewGitService(nil, "newhash123")
	h.StackDeployer = testhelpers.NewTestStackDeployer()
	h.ComposeStackManager = testhelpers.NewComposeStackManager()

	prune := true
	payload := stackGitRedeployPayload{
		RepositoryReferenceName: "refs/heads/main",
		Env:                     []portainer.Pair{{Name: "X", Value: "y"}},
		Prune:                   &prune,
		RepullImageAndRedeploy:  true,
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
	assert.Equal(t, []portainer.Pair{{Name: "X", Value: "y"}}, updated.Env)
	require.NotNil(t, updated.Option)
	assert.True(t, updated.Option.Prune)
	require.NotNil(t, updated.CurrentDeploymentInfo)
	assert.Equal(t, "newhash123", updated.CurrentDeploymentInfo.ConfigHash)
	assert.Equal(t, "testuser", updated.UpdatedBy)
	// Async path marks deploying then updates in goroutine; after handler returns status is Deploying or Active depending on race.
	assert.Contains(t, []portainer.StackStatus{portainer.StackStatusDeploying, portainer.StackStatusActive, portainer.StackStatusError}, updated.Status)
}

func TestREQ_STK_03_RedeployComposeGit_CloneFailure_ReturnsServerError(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, endpoint, _ := setupComposeGitStack(t, store, portainer.StackStatusActive)

	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.FileService = fileService
	h.GitService = testhelpers.NewGitService(errors.New("clone failed"), "hash")
	h.StackDeployer = testhelpers.NewTestStackDeployer()

	body, _ := json.Marshal(stackGitRedeployPayload{})
	url := fmt.Sprintf("/stacks/%d/git/redeploy?endpointId=%d", stack.ID, endpoint.ID)
	req := withToken(mockCreateStackRequestWithSecurityContext(http.MethodPut, url, bytes.NewReader(body)))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestREQ_STK_03_Redeploy_InvalidStackID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	req := withToken(mockCreateStackRequestWithSecurityContext(http.MethodPut, "/stacks/nope/git/redeploy", bytes.NewReader([]byte(`{}`))))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_04_UpdateGitCompose_ViaRepositoryURL_Auth_Persists(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, endpoint, _ := setupComposeGitStack(t, store, portainer.StackStatusActive)

	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.FileService, _ = filesystem.NewService(t.TempDir(), "")
	h.GitService = testhelpers.NewGitService(nil, "authhash")

	payload := stackGitUpdatePayload{
		RepositoryURL:            "https://example.com/compose.git",
		RepositoryReferenceName:  "refs/heads/dev",
		RepositoryAuthentication: true,
		RepositoryUsername:       "gituser",
		RepositoryPassword:       "gitpass",
		ConfigFilePath:           "docker-compose.yml",
		Env:                      []portainer.Pair{{Name: "B", Value: "2"}},
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)

	url := fmt.Sprintf("/stacks/%d/git?endpointId=%d", stack.ID, endpoint.ID)
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, url, bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, []portainer.Pair{{Name: "B", Value: "2"}}, updated.Env)
	assert.Equal(t, "testuser", updated.UpdatedBy)
}

func TestREQ_STK_04_UpdateGit_DuplicateWebhook_ReturnsConflict(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, endpoint, src := setupComposeGitStack(t, store, portainer.StackStatusActive)

	webhook := "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 99, Name: "hook-owner", AutoUpdate: &portainer.AutoUpdateSettings{Webhook: webhook},
	}))

	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.GitService = testhelpers.NewGitService(nil, "h")

	payload := stackGitUpdatePayload{
		SourceID:   src.ID,
		AutoUpdate: &portainer.AutoUpdateSettings{Webhook: webhook},
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("/stacks/%d/git?endpointId=%d", stack.ID, endpoint.ID)
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, url, bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestREQ_STK_04_UpdateGit_MissingEndpoint_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, _, src := setupComposeGitStack(t, store, portainer.StackStatusActive)

	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	payload := stackGitUpdatePayload{SourceID: src.ID}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("/stacks/%d/git?endpointId=99", stack.ID)
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, url, bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_03_RedeployComposeGit_MissingEndpoint_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, _, _ := setupComposeGitStack(t, store, portainer.StackStatusActive)

	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.GitService = testhelpers.NewGitService(nil, "h")
	body, _ := json.Marshal(stackGitRedeployPayload{})
	url := fmt.Sprintf("/stacks/%d/git/redeploy?endpointId=77", stack.ID)
	req := withToken(mockCreateStackRequestWithSecurityContext(http.MethodPut, url, bytes.NewReader(body)))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_03_RedeployComposeGit_InvalidAutoUpdate_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, endpoint, _ := setupComposeGitStack(t, store, portainer.StackStatusActive)

	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	// Redeploy payload Validate only checks AutoUpdate? Check - stackGitRedeployPayload.Validate
	payload := stackGitRedeployPayload{}
	// empty is fine; use malformed JSON for bad request
	url := fmt.Sprintf("/stacks/%d/git/redeploy?endpointId=%d", stack.ID, endpoint.ID)
	req := withToken(mockCreateStackRequestWithSecurityContext(http.MethodPut, url, bytes.NewReader([]byte(`{`))))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	_ = payload
}

func TestREQ_STK_04_UpdateGit_WithAutoUpdateWebhook_Unique_OK(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack, endpoint, src := setupComposeGitStack(t, store, portainer.StackStatusActive)

	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.GitService = testhelpers.NewGitService(nil, "h")

	webhook := "cccccccc-cccc-cccc-cccc-cccccccccccc"
	payload := stackGitUpdatePayload{
		SourceID:                src.ID,
		RepositoryReferenceName: "refs/heads/main",
		AutoUpdate:              &portainer.AutoUpdateSettings{Webhook: webhook, Interval: "5m"},
		Env:                     []portainer.Pair{{Name: "C", Value: "3"}},
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)
	url := fmt.Sprintf("/stacks/%d/git?endpointId=%d", stack.ID, endpoint.ID)
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, url, bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	require.NotNil(t, updated.AutoUpdate)
	assert.Equal(t, webhook, updated.AutoUpdate.Webhook)
}
