package stacks

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/api/stacks/stackutils"
	"github.com/portainer/portainer/pkg/fips"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_STK_04_UpdateComposeStack_HTTP_PersistsContentAndEnv(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	_, store := datastore.MustNewTestStore(t, true, false)
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)

	_, err = mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	stack := &portainer.Stack{
		ID:          1,
		Name:        "compose-upd",
		Type:        portainer.DockerComposeStack,
		EndpointID:  endpoint.ID,
		EntryPoint:  "docker-compose.yml",
		ProjectPath: fileService.GetDatastorePath() + "/compose/1",
		Status:      portainer.StackStatusActive,
	}
	require.NoError(t, store.Stack().Create(stack))
	require.NoError(t, store.ResourceControl().Create(&portainer.ResourceControl{
		ID: 1, ResourceID: stackutils.ResourceControlID(endpoint.ID, stack.Name),
		Type: portainer.StackResourceControl, AdministratorsOnly: false,
	}))
	_, err = fileService.StoreStackFileFromBytes(strconv.Itoa(int(stack.ID)), stack.EntryPoint, []byte("services:\n  web:\n    image: alpine:1\n"))
	require.NoError(t, err)

	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.FileService = fileService
	h.StackDeployer = testhelpers.NewTestStackDeployer()
	h.ComposeStackManager = testhelpers.NewComposeStackManager()

	payload := updateComposeStackPayload{
		StackFileContent:       "services:\n  web:\n    image: alpine:2\n",
		Env:                    []portainer.Pair{{Name: "U", Value: "1"}},
		Prune:                  true,
		RepullImageAndRedeploy: true,
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)

	req := mockCreateStackRequestWithSecurityContext(
		http.MethodPut,
		fmt.Sprintf("/stacks/%d?endpointId=%d", stack.ID, endpoint.ID),
		bytes.NewReader(body),
	)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, []portainer.Pair{{Name: "U", Value: "1"}}, updated.Env)
	require.NotNil(t, updated.Option)
	assert.True(t, updated.Option.Prune)
}

func TestREQ_STK_04_UpdateComposeStack_EmptyContent_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	_, err = mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "c", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID, EntryPoint: "docker-compose.yml",
		ProjectPath: fileService.GetDatastorePath() + "/compose/1", Status: portainer.StackStatusActive,
	}))

	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.FileService = fileService
	h.StackDeployer = testhelpers.NewTestStackDeployer()
	h.ComposeStackManager = testhelpers.NewComposeStackManager()

	body, _ := json.Marshal(updateComposeStackPayload{StackFileContent: ""})
	req := mockCreateStackRequestWithSecurityContext(
		http.MethodPut, fmt.Sprintf("/stacks/1?endpointId=%d", endpoint.ID), bytes.NewReader(body),
	)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_04_UpdateStack_MissingStack_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	body, _ := json.Marshal(updateComposeStackPayload{StackFileContent: "services: {}\n"})
	req := mockCreateStackRequestWithSecurityContext(
		http.MethodPut, fmt.Sprintf("/stacks/404?endpointId=%d", endpoint.ID), bytes.NewReader(body),
	)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_04_UpdateSwarmPayload_EmptyContent_Invalid(t *testing.T) {
	t.Parallel()
	payload := &updateSwarmStackPayload{}
	require.Error(t, payload.Validate(nil))
	payload.StackFileContent = "services: {}\n"
	require.NoError(t, payload.Validate(nil))
}
