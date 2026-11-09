package stacks

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newStackFileHandler(t *testing.T) (*Handler, *datastore.Store) {
	t.Helper()
	_, store := datastore.MustNewTestStore(t, true, false)
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.FileService = fileService
	return h, store
}

func TestREQ_STK_04_StackFile_InvalidID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, _ := newStackFileHandler(t)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodGet, "/stacks/abc/file", nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_04_StackFile_MissingStack_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, store := newStackFileHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodGet, "/stacks/99/file", nil))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_04_StackFile_OrphanEndpoint_Admin_ReturnsContent(t *testing.T) {
	t.Parallel()
	h, store := newStackFileHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	project := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(project, "docker-compose.yml"), []byte("services:\n  web:\n    image: alpine\n"), 0o600))
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "orphan-file", Type: portainer.DockerComposeStack, EndpointID: 55,
		ProjectPath: project, EntryPoint: "docker-compose.yml",
	}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodGet, "/stacks/1/file", nil))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	assert.Contains(t, w.Body.String(), "alpine")
}

func TestREQ_STK_04_StackFile_ManageDisabled_NonAdmin_ReturnsForbidden(t *testing.T) {
	t.Parallel()
	h, store := newStackFileHandler(t)
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
		ProjectPath: t.TempDir(), EntryPoint: "docker-compose.yml",
	}))
	req := httptest.NewRequest(http.MethodGet, "/stacks/1/file", nil)
	ctx := security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		IsAdmin: false, UserID: 2, User: std,
	})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req.WithContext(ctx))
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestREQ_STK_04_StackFile_MissingFileOnDisk_ReturnsServerError(t *testing.T) {
	t.Parallel()
	h, store := newStackFileHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "s", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID,
		ProjectPath: filepath.Join(t.TempDir(), "missing"), EntryPoint: "docker-compose.yml",
	}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodGet, "/stacks/1/file", nil))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestREQ_STK_04_StackFile_OrphanEndpoint_NonAdmin_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, store := newStackFileHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	std := &portainer.User{ID: 2, Username: "std", Role: portainer.StandardUserRole}
	require.NoError(t, store.User().Create(std))
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "s", Type: portainer.DockerComposeStack, EndpointID: 77,
		ProjectPath: t.TempDir(), EntryPoint: "docker-compose.yml",
	}))
	req := httptest.NewRequest(http.MethodGet, "/stacks/1/file", nil)
	ctx := security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		IsAdmin: false, UserID: 2, User: std,
	})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req.WithContext(ctx))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

