package stacks

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/api/stacks/stackutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func stackCreateRequestWithToken(method, target string, body []byte) *http.Request {
	req := mockCreateStackRequestWithSecurityContext(method, target, bytes.NewReader(body))
	return req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
		ID:       1,
		Username: "testUser",
		Role:     portainer.AdministratorRole,
	}))
}

func newStackCreateHandler(t *testing.T) (*Handler, *datastore.Store) {
	t.Helper()
	_, store := datastore.MustNewTestStore(t, true, false)
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.FileService = fileService
	h.ComposeStackManager = testhelpers.NewComposeStackManager()
	h.StackDeployer = testhelpers.NewTestStackDeployer()
	return h, store
}

func TestREQ_STK_02_CreateComposeFromString_PersistsStackAndResourceControl(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	payload := composeStackFromFileContentPayload{
		Name:             "compose-from-string",
		StackFileContent: "services:\n  web:\n    image: nginx:alpine\n",
		Env:              []portainer.Pair{{Name: "FOO", Value: "bar"}},
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)

	url := fmt.Sprintf("/stacks/create/standalone/string?endpointId=%d", endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackCreateRequestWithToken(http.MethodPost, url, body))

	require.Equal(t, http.StatusOK, w.Code)
	var resp portainer.Stack
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "compose-from-string", resp.Name)
	assert.Equal(t, portainer.DockerComposeStack, resp.Type)
	assert.Equal(t, endpoint.ID, resp.EndpointID)
	assert.NotZero(t, resp.ID)
	require.NotNil(t, resp.ResourceControl)
	assert.Equal(t, stackutils.ResourceControlID(endpoint.ID, resp.Name), resp.ResourceControl.ResourceID)

	stored, err := store.Stack().Read(resp.ID)
	require.NoError(t, err)
	assert.Equal(t, payload.Env, stored.Env)
}

func TestREQ_STK_02_CreateComposeFromString_DuplicateName_ReturnsConflict(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 10, Name: "dup-name", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID,
	}))

	payload := composeStackFromFileContentPayload{
		Name:             "dup-name",
		StackFileContent: "services:\n  web:\n    image: alpine\n",
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)

	url := fmt.Sprintf("/stacks/create/standalone/string?endpointId=%d", endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackCreateRequestWithToken(http.MethodPost, url, body))

	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestREQ_STK_02_CreateComposeFromString_EmptyName_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	payload := composeStackFromFileContentPayload{Name: "", StackFileContent: "services: {}\n"}
	body, err := json.Marshal(payload)
	require.NoError(t, err)
	url := fmt.Sprintf("/stacks/create/standalone/string?endpointId=%d", endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackCreateRequestWithToken(http.MethodPost, url, body))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_02_CreateComposeFromString_EmptyFile_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	payload := composeStackFromFileContentPayload{Name: "empty-file", StackFileContent: ""}
	body, err := json.Marshal(payload)
	require.NoError(t, err)
	url := fmt.Sprintf("/stacks/create/standalone/string?endpointId=%d", endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackCreateRequestWithToken(http.MethodPost, url, body))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_02_CreateStack_MissingEndpointId_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)

	body, _ := json.Marshal(composeStackFromFileContentPayload{Name: "x", StackFileContent: "services: {}\n"})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackCreateRequestWithToken(http.MethodPost, "/stacks/create/standalone/string", body))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_02_CreateStack_UnknownEndpoint_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)

	body, _ := json.Marshal(composeStackFromFileContentPayload{Name: "x", StackFileContent: "services: {}\n"})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackCreateRequestWithToken(http.MethodPost, "/stacks/create/standalone/string?endpointId=99", body))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_02_CreateStack_InvalidType_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	body, _ := json.Marshal(composeStackFromFileContentPayload{Name: "x", StackFileContent: "services: {}\n"})
	url := fmt.Sprintf("/stacks/create/notatype/string?endpointId=%d", endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackCreateRequestWithToken(http.MethodPost, url, body))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_02_CreateCompose_InvalidMethod_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	body, _ := json.Marshal(map[string]string{"Name": "x"})
	url := fmt.Sprintf("/stacks/create/standalone/ftp?endpointId=%d", endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackCreateRequestWithToken(http.MethodPost, url, body))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_02_ComposeGitPayload_AuthWithoutPassword_ReturnsError(t *testing.T) {
	t.Parallel()
	payload := &composeStackFromGitRepositoryPayload{
		Name:                     "git-stack",
		RepositoryURL:            "https://github.com/example/repo.git",
		RepositoryAuthentication: true,
		RepositoryUsername:       "user",
	}
	err := payload.Validate(nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "Password")
}

func TestREQ_STK_02_ComposeGitPayload_EmptyURLWithoutSource_ReturnsError(t *testing.T) {
	t.Parallel()
	payload := &composeStackFromGitRepositoryPayload{
		Name:          "git-stack",
		RepositoryURL: "",
	}
	err := payload.Validate(nil)
	require.Error(t, err)
}

func TestREQ_STK_02_CreateStackPayloadHelpers_MapFields(t *testing.T) {
	t.Parallel()
	filePayload := createStackPayloadFromComposeFileContentPayload("n", "content", []portainer.Pair{{Name: "A", Value: "1"}}, true)
	assert.Equal(t, "n", filePayload.Name)
	assert.Equal(t, []byte("content"), filePayload.StackFileContent)
	assert.True(t, filePayload.FromAppTemplate)

	gitPayload := createStackPayloadFromComposeGitPayload("g", "https://example.com/r.git", "refs/heads/main", "u", "p", true, "compose.yml", []string{"a.yml"}, nil, nil, false, true, 7)
	assert.Equal(t, "g", gitPayload.Name)
	assert.Equal(t, portainer.SourceID(7), gitPayload.RepositoryConfigPayload.SourceID)
	assert.Equal(t, "https://example.com/r.git", gitPayload.RepositoryConfigPayload.URL)
	assert.Equal(t, "compose.yml", gitPayload.ComposeFile)
	assert.True(t, gitPayload.RepositoryConfigPayload.TLSSkipVerify)

	uploadPayload := createStackPayloadFromComposeFileUploadPayload("u", []byte("file"), []portainer.Pair{{Name: "E", Value: "v"}})
	assert.Equal(t, "u", uploadPayload.Name)
	assert.Equal(t, []byte("file"), uploadPayload.StackFileContent)
}

func TestREQ_STK_02_CheckUniqueStackName_DetectsCollision(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{ID: 1, Name: "taken", EndpointID: endpoint.ID}))

	unique, err := h.checkUniqueStackName(endpoint, "taken", 0)
	require.NoError(t, err)
	assert.False(t, unique)

	unique, err = h.checkUniqueStackName(endpoint, "taken", 1)
	require.NoError(t, err)
	assert.True(t, unique, "same stack id is allowed to keep its name")

	unique, err = h.checkUniqueStackName(endpoint, "free", 0)
	require.NoError(t, err)
	assert.True(t, unique)
}

func TestREQ_STK_09_CheckUniqueWebhookID(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "with-hook", AutoUpdate: &portainer.AutoUpdateSettings{Webhook: "11111111-1111-1111-1111-111111111111"},
	}))

	unique, err := h.checkUniqueWebhookID(store, "11111111-1111-1111-1111-111111111111")
	require.NoError(t, err)
	assert.False(t, unique)

	unique, err = h.checkUniqueWebhookID(store, "22222222-2222-2222-2222-222222222222")
	require.NoError(t, err)
	assert.True(t, unique)
}

func TestREQ_STK_02_EnsureUniqueComposeStackName_CleansSwarmDuplicate(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	swarmDup := &portainer.Stack{ID: 3, Name: "shared-name", Type: portainer.DockerSwarmStack, EndpointID: endpoint.ID}
	require.NoError(t, store.Stack().Create(swarmDup))

	errHTTP := h.ensureUniqueComposeStackName(nil, nil, endpoint, 1, "shared-name")
	require.Nil(t, errHTTP)
	_, err = store.Stack().Read(swarmDup.ID)
	assert.True(t, store.IsErrObjectNotFound(err), "swarm duplicate with same name should be cleaned")
}

