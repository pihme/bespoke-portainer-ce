package stacks

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices/source"
	"github.com/portainer/portainer/api/filesystem"
	gittypes "github.com/portainer/portainer/api/git/types"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_STK_02_CreateComposeFromGit_ViaSourceID_PersistsStack(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint := &portainer.Endpoint{
		ID: 1, Name: "docker", Type: portainer.DockerEnvironment,
		SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true},
	}
	require.NoError(t, store.Endpoint().Create(endpoint))

	admin := source.InsecureNewAdminContext()
	src := &portainer.Source{Type: portainer.SourceTypeGit, Git: &gittypes.GitSource{URL: "https://example.com/r.git"}}
	require.NoError(t, store.Source().Create(admin, src))

	h.GitService = testhelpers.NewGitService(nil, "commithash")
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h.FileService = fileService

	payload := composeStackFromGitRepositoryPayload{
		Name:        "from-git-source",
		SourceID:    src.ID,
		ComposeFile: "docker-compose.yml",
		Env:         []portainer.Pair{{Name: "E", Value: "1"}},
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)

	url := fmt.Sprintf("/stacks/create/standalone/repository?endpointId=%d", endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackCreateRequestWithToken(http.MethodPost, url, body))

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var resp portainer.Stack
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "from-git-source", resp.Name)
	assert.Equal(t, portainer.DockerComposeStack, resp.Type)
	assert.NotZero(t, resp.WorkflowID)
	assert.Equal(t, []portainer.Pair{{Name: "E", Value: "1"}}, resp.Env)
}

func TestREQ_STK_09_CreateComposeFromGit_DuplicateWebhook_ReturnsConflict(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	webhook := "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "other", AutoUpdate: &portainer.AutoUpdateSettings{Webhook: webhook},
	}))

	admin := source.InsecureNewAdminContext()
	src := &portainer.Source{Type: portainer.SourceTypeGit, Git: &gittypes.GitSource{URL: "https://example.com/r.git"}}
	require.NoError(t, store.Source().Create(admin, src))
	h.GitService = testhelpers.NewGitService(nil, "h")

	payload := composeStackFromGitRepositoryPayload{
		Name:     "new-with-hook",
		SourceID: src.ID,
		AutoUpdate: &portainer.AutoUpdateSettings{
			Webhook: webhook,
		},
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("/stacks/create/standalone/repository?endpointId=%d", endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackCreateRequestWithToken(http.MethodPost, url, body))
	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestREQ_STK_02_CreateComposeFromGit_UnknownSource_ReturnsError(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	payload := composeStackFromGitRepositoryPayload{
		Name:     "bad-source",
		SourceID: 999,
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("/stacks/create/standalone/repository?endpointId=%d", endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackCreateRequestWithToken(http.MethodPost, url, body))
	assert.NotEqual(t, http.StatusOK, w.Code)
}

func TestREQ_STK_02_ComposeGitPayload_ValidURLWithoutAuth_OK(t *testing.T) {
	t.Parallel()
	payload := &composeStackFromGitRepositoryPayload{
		Name:          "n",
		RepositoryURL: "https://github.com/example/repo.git",
	}
	require.NoError(t, payload.Validate(nil))
}

func TestREQ_STK_02_CreateComposeFromGit_ViaRepositoryURL_PersistsStack(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	h.GitService = testhelpers.NewGitService(nil, "urlhash")

	payload := composeStackFromGitRepositoryPayload{
		Name:                    "from-git-url",
		RepositoryURL:           "https://example.com/compose.git",
		RepositoryReferenceName: "refs/heads/main",
		ComposeFile:             "docker-compose.yml",
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)

	url := fmt.Sprintf("/stacks/create/standalone/repository?endpointId=%d", endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackCreateRequestWithToken(http.MethodPost, url, body))

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var resp portainer.Stack
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "from-git-url", resp.Name)
	assert.Equal(t, portainer.DockerComposeStack, resp.Type)
	assert.NotZero(t, resp.WorkflowID)
}

func TestREQ_STK_02_CreateComposeFromGit_DuplicateName_ReturnsConflict(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 5, Name: "taken-git", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID,
	}))

	admin := source.InsecureNewAdminContext()
	src := &portainer.Source{Type: portainer.SourceTypeGit, Git: &gittypes.GitSource{URL: "https://example.com/r.git"}}
	require.NoError(t, store.Source().Create(admin, src))
	h.GitService = testhelpers.NewGitService(nil, "h")

	payload := composeStackFromGitRepositoryPayload{Name: "taken-git", SourceID: src.ID}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("/stacks/create/standalone/repository?endpointId=%d", endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackCreateRequestWithToken(http.MethodPost, url, body))
	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestREQ_STK_02_ComposeGitPayload_AuthWithPassword_OK(t *testing.T) {
	t.Parallel()
	payload := &composeStackFromGitRepositoryPayload{
		Name:                     "n",
		RepositoryURL:            "https://github.com/example/repo.git",
		RepositoryAuthentication: true,
		RepositoryUsername:       "u",
		RepositoryPassword:       "p",
	}
	require.NoError(t, payload.Validate(nil))
}
