package stacks

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_STK_07_MigrateInvalidStackID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	body, _ := json.Marshal(stackMigratePayload{EndpointID: 1})
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/abc/migrate", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_07_MigrateMissingSourceEndpoint_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "s", Type: portainer.DockerComposeStack, EndpointID: 55,
	}))
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	body, _ := json.Marshal(stackMigratePayload{EndpointID: 1})
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/1/migrate", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_07_MigrateMissingTargetEndpoint_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "s", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID,
	}))
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	body, _ := json.Marshal(stackMigratePayload{EndpointID: 99})
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/1/migrate", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_07_MigrateManageDisabled_NonAdmin_ReturnsForbidden(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	std := &portainer.User{ID: 2, Username: "std", Role: portainer.StandardUserRole}
	require.NoError(t, store.User().Create(std))
	endpoint := &portainer.Endpoint{
		ID: 1, Name: "docker", Type: portainer.DockerEnvironment,
		SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: false},
	}
	require.NoError(t, store.Endpoint().Create(endpoint))
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "s", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID,
	}))
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	body, _ := json.Marshal(stackMigratePayload{EndpointID: 2})
	req := httptest.NewRequest(http.MethodPost, "/stacks/1/migrate", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req.WithContext(securityStoreNonAdmin(req, std)))
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestREQ_STK_07_MigrateCompose_SameNameNoRename_Succeeds(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	_, err = mockCreateUser(store)
	require.NoError(t, err)
	src := &portainer.Endpoint{
		ID: 1, Name: "src", Type: portainer.DockerEnvironment,
		SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true},
	}
	dst := &portainer.Endpoint{
		ID: 2, Name: "dst", Type: portainer.DockerEnvironment,
		SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true},
	}
	require.NoError(t, store.Endpoint().Create(src))
	require.NoError(t, store.Endpoint().Create(dst))

	stack := &portainer.Stack{
		ID: 1, Name: "keep-name", Type: portainer.DockerComposeStack, EndpointID: src.ID,
		EntryPoint: "docker-compose.yml", ProjectPath: fileService.GetDatastorePath() + "/compose/1",
		Status: portainer.StackStatusActive,
	}
	require.NoError(t, store.Stack().Create(stack))
	_, err = fileService.StoreStackFileFromBytes("1", "docker-compose.yml", []byte("services:\n  web:\n    image: alpine\n"))
	require.NoError(t, err)

	h := NewHandler(testhelpers.NewTestRequestBouncer(), &stubTeardown{})
	h.DataStore = store
	h.FileService = fileService
	h.StackDeployer = testhelpers.NewTestStackDeployer()
	h.ComposeStackManager = testhelpers.NewComposeStackManager()

	body, _ := json.Marshal(stackMigratePayload{EndpointID: int(dst.ID)})
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/1/migrate", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	updated, err := store.Stack().Read(1)
	require.NoError(t, err)
	assert.Equal(t, dst.ID, updated.EndpointID)
	assert.Equal(t, "keep-name", updated.Name)
}

