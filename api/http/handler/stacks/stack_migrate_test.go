package stacks

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/api/stacks/stackutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_STK_07_MigratePayload_RequiresEndpointID(t *testing.T) {
	t.Parallel()
	payload := &stackMigratePayload{}
	err := payload.Validate(nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "environment identifier")

	payload.EndpointID = 2
	require.NoError(t, payload.Validate(nil))
}

func TestREQ_STK_07_MigrateKubernetesStack_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), &stubTeardown{})
	h.DataStore = store
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "k8s", Type: portainer.KubernetesStack, EndpointID: endpoint.ID,
	}))

	body, _ := json.Marshal(stackMigratePayload{EndpointID: int(endpoint.ID)})
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/1/migrate", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_07_MigrateMissingStack_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), &stubTeardown{})
	h.DataStore = store
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	_, err = mockCreateEndpoint(store)
	require.NoError(t, err)

	body, _ := json.Marshal(stackMigratePayload{EndpointID: 1})
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/99/migrate", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_07_MigrateInvalidPayload_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), &stubTeardown{})
	h.DataStore = store
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "c", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID,
	}))

	body, _ := json.Marshal(stackMigratePayload{EndpointID: 0})
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/1/migrate", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_07_MigrateComposeStack_ToNewEndpointWithRename(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	teardown := &stubTeardown{}
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), teardown)
	h.DataStore = store
	h.FileService = fileService
	h.StackDeployer = testhelpers.NewTestStackDeployer()
	h.ComposeStackManager = testhelpers.NewComposeStackManager()

	_, err = mockCreateUser(store)
	require.NoError(t, err)
	srcEndpoint := &portainer.Endpoint{ID: 1, Name: "src", SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true}}
	require.NoError(t, store.Endpoint().Create(srcEndpoint))
	dstEndpoint := &portainer.Endpoint{ID: 2, Name: "dst", SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true}}
	require.NoError(t, store.Endpoint().Create(dstEndpoint))

	projectPath := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(projectPath, "docker-compose.yml"), []byte("services:\n  web:\n    image: alpine\n"), 0o600))

	stack := &portainer.Stack{
		ID:          5,
		Name:        "migrate-me",
		Type:        portainer.DockerComposeStack,
		EndpointID:  srcEndpoint.ID,
		EntryPoint:  "docker-compose.yml",
		ProjectPath: projectPath,
		Status:      portainer.StackStatusActive,
	}
	require.NoError(t, store.Stack().Create(stack))
	require.NoError(t, store.ResourceControl().Create(&portainer.ResourceControl{
		ResourceID: stackutils.ResourceControlID(srcEndpoint.ID, stack.Name),
		Type:       portainer.StackResourceControl,
		Public:     true,
	}))

	body, _ := json.Marshal(stackMigratePayload{EndpointID: int(dstEndpoint.ID), Name: "migrated-name"})
	url := fmt.Sprintf("/stacks/%d/migrate", stack.ID)
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, url, bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, dstEndpoint.ID, updated.EndpointID)
	assert.Equal(t, "migrated-name", updated.Name)
	require.Contains(t, teardown.torndownStacks, stack.ID)

	var resp portainer.Stack
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "migrated-name", resp.Name)
	assert.Equal(t, dstEndpoint.ID, resp.EndpointID)
}

func TestREQ_STK_07_MigrateComposeStack_NameCollision_ReturnsConflict(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), &stubTeardown{})
	h.DataStore = store
	h.ComposeStackManager = testhelpers.NewComposeStackManager()
	h.StackDeployer = testhelpers.NewTestStackDeployer()
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	src := &portainer.Endpoint{ID: 1, Name: "src", SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true}}
	require.NoError(t, store.Endpoint().Create(src))
	dst := &portainer.Endpoint{ID: 2, Name: "dst", SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true}}
	require.NoError(t, store.Endpoint().Create(dst))

	require.NoError(t, store.Stack().Create(&portainer.Stack{ID: 1, Name: "same", Type: portainer.DockerComposeStack, EndpointID: src.ID, ProjectPath: t.TempDir(), EntryPoint: "docker-compose.yml"}))
	require.NoError(t, store.Stack().Create(&portainer.Stack{ID: 2, Name: "same", Type: portainer.DockerComposeStack, EndpointID: dst.ID}))

	body, _ := json.Marshal(stackMigratePayload{EndpointID: int(dst.ID)})
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/1/migrate", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusConflict, w.Code)
}

