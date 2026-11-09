package stacks

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/http/security"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func stackDeleteRequestNonAdmin(stackID portainer.StackID, endpointID portainer.EndpointID) *http.Request {
	url := fmt.Sprintf("/stacks/%d?endpointId=%d", stackID, endpointID)
	req := httptest.NewRequest(http.MethodDelete, url, nil)
	ctx := security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		IsAdmin: false,
		UserID:  2,
		User:    &portainer.User{ID: 2, Role: portainer.StandardUserRole},
	})
	return req.WithContext(ctx)
}

func TestREQ_STK_08_DeleteCompose_InvalidID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store, _ := newStackDeleteHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodDelete, "/stacks/abc?endpointId=1", nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_08_DeleteCompose_MissingStack_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, store, _ := newStackDeleteHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackDeleteRequest(99, endpoint.ID))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_08_DeleteCompose_MissingEndpoint_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, store, _ := newStackDeleteHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "s", Type: portainer.DockerComposeStack, EndpointID: 1,
	}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackDeleteRequest(1, 99))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_08_DeleteOrphanedCompose_NonAdmin_ReturnsForbidden(t *testing.T) {
	t.Parallel()
	h, store, _ := newStackDeleteHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	std := &portainer.User{ID: 2, Username: "std", Role: portainer.StandardUserRole}
	require.NoError(t, store.User().Create(std))
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "orphan", Type: portainer.DockerComposeStack, EndpointID: 5, // different from query
	}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackDeleteRequestNonAdmin(1, endpoint.ID))
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestREQ_STK_08_DeleteCompose_ManageDisabled_NonAdmin_ReturnsForbidden(t *testing.T) {
	t.Parallel()
	h, store, _ := newStackDeleteHandler(t)
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
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackDeleteRequestNonAdmin(1, endpoint.ID))
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestREQ_STK_08_DeleteExternal_MissingEndpointId_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store, _ := newStackDeleteHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodDelete, "/stacks/ext?external=true", nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_08_DeleteExternal_NameExistsInDB_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store, _ := newStackDeleteHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "exists", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID,
	}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, deleteExternalStackRequest("exists", endpoint.ID))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_08_DeleteExternal_NonAdmin_ReturnsUnauthorized(t *testing.T) {
	t.Parallel()
	h, store, _ := newStackDeleteHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	std := &portainer.User{ID: 2, Username: "std", Role: portainer.StandardUserRole}
	require.NoError(t, store.User().Create(std))
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	url := fmt.Sprintf("/stacks/ghost?endpointId=%d&external=true", endpoint.ID)
	req := httptest.NewRequest(http.MethodDelete, url, nil)
	ctx := security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		IsAdmin: false, UserID: 2, User: std,
	})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req.WithContext(ctx))
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestREQ_STK_08_DeleteExternal_MissingEndpoint_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, store, _ := newStackDeleteHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, deleteExternalStackRequest("ghost", 99))
	assert.Equal(t, http.StatusNotFound, w.Code)
}
