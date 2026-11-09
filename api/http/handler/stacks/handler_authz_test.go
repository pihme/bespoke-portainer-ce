package stacks

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_STK_02_UserIsAdmin_AndCreatePermission(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	admin, err := mockCreateUser(store)
	require.NoError(t, err)

	isAdmin, err := h.userIsAdmin(admin.ID)
	require.NoError(t, err)
	assert.True(t, isAdmin)

	std := &portainer.User{ID: 2, Username: "user", Role: portainer.StandardUserRole}
	require.NoError(t, store.User().Create(std))
	isAdmin, err = h.userIsAdmin(std.ID)
	require.NoError(t, err)
	assert.False(t, isAdmin)

	canCreate, err := h.userCanCreateStack(&security.RestrictedRequestContext{UserID: admin.ID})
	require.NoError(t, err)
	assert.True(t, canCreate)
}

func TestREQ_STK_02_UserCanManageStacks_DisabledForRegularUsers(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	admin, err := mockCreateUser(store)
	require.NoError(t, err)
	std := &portainer.User{ID: 2, Username: "user", Role: portainer.StandardUserRole}
	require.NoError(t, store.User().Create(std))

	endpoint := &portainer.Endpoint{
		ID: 1, Name: "docker", Type: portainer.DockerEnvironment,
		SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: false},
	}
	require.NoError(t, store.Endpoint().Create(endpoint))

	ok, err := h.userCanManageStacks(&security.RestrictedRequestContext{UserID: admin.ID, IsAdmin: true}, endpoint)
	require.NoError(t, err)
	assert.True(t, ok)

	ok, err = h.userCanManageStacks(&security.RestrictedRequestContext{UserID: std.ID}, endpoint)
	require.NoError(t, err)
	assert.False(t, ok)

	ok, err = h.userCanManageStacks(&security.RestrictedRequestContext{UserID: admin.ID}, nil)
	require.NoError(t, err)
	assert.True(t, ok, "orphan stacks: nil endpoint allows management")
}

func TestREQ_STK_04_UpdateComposePayload_EmptyContent_Invalid(t *testing.T) {
	t.Parallel()
	payload := &updateComposeStackPayload{}
	require.Error(t, payload.Validate(nil))
	payload.StackFileContent = "services: {}\n"
	require.NoError(t, payload.Validate(nil))
}

func TestREQ_STK_02_CreateSwarm_InvalidMethod_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	body, _ := json.Marshal(map[string]string{"Name": "x"})
	url := fmt.Sprintf("/stacks/create/swarm/ftp?endpointId=%d", endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackCreateRequestWithToken(http.MethodPost, url, body))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_02_CreateKubernetes_InvalidMethod_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	body, _ := json.Marshal(map[string]string{"Name": "x"})
	url := fmt.Sprintf("/stacks/create/kubernetes/ftp?endpointId=%d", endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackCreateRequestWithToken(http.MethodPost, url, body))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_05_StartMissingEndpoint_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, store := newStackStartHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "s", Type: portainer.DockerComposeStack, Status: portainer.StackStatusInactive, EndpointID: 1,
	}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackStartRequest(1, 99))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_05_StartMissingStack_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, store := newStackStartHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackStartRequest(99, endpoint.ID))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_01_Inspect_OrphanEndpointMissing_AdminOK(t *testing.T) {
	t.Parallel()
	h, store := newStackInspectHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	// stack points at missing endpoint; admin may still inspect
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 8, Name: "orphan", Type: portainer.DockerComposeStack, EndpointID: 55, Status: portainer.StackStatusInactive,
	}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackInspectRequest(8))
	require.Equal(t, http.StatusOK, w.Code)
	var resp stackResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "orphan", resp.Name)
}

func TestREQ_STK_02_UserCanAccessStack_AdminWithoutRC_OK(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	admin, err := mockCreateUser(store)
	require.NoError(t, err)

	ok, err := h.userCanAccessStack(&security.RestrictedRequestContext{UserID: admin.ID}, nil)
	require.NoError(t, err)
	assert.True(t, ok)

	std := &portainer.User{ID: 2, Username: "user", Role: portainer.StandardUserRole}
	require.NoError(t, store.User().Create(std))
	ok, err = h.userCanAccessStack(&security.RestrictedRequestContext{UserID: std.ID}, nil)
	require.NoError(t, err)
	assert.False(t, ok)
}

func TestREQ_STK_02_UserCanAccessStack_WithPublicRC_OK(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	std := &portainer.User{ID: 2, Username: "user", Role: portainer.StandardUserRole}
	require.NoError(t, store.User().Create(std))

	rc := &portainer.ResourceControl{
		ID:                 1,
		ResourceID:         "1_stack",
		Type:               portainer.StackResourceControl,
		Public:             true,
		AdministratorsOnly: false,
	}
	ok, err := h.userCanAccessStack(&security.RestrictedRequestContext{UserID: std.ID}, rc)
	require.NoError(t, err)
	assert.True(t, ok)
}

func TestREQ_STK_02_StackExistsError_IsConflict(t *testing.T) {
	t.Parallel()
	errHTTP := stackExistsError("my-stack")
	require.NotNil(t, errHTTP)
	assert.Equal(t, http.StatusConflict, errHTTP.StatusCode)
	assert.Contains(t, errHTTP.Message, "my-stack")
}

func TestREQ_STK_02_CheckUniqueStackNameInDocker_WithoutFactory_UsesDB(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{ID: 1, Name: "db-only", EndpointID: endpoint.ID}))

	unique, err := h.checkUniqueStackNameInDocker(endpoint, "db-only", 0, false)
	require.NoError(t, err)
	assert.False(t, unique)

	unique, err = h.checkUniqueStackNameInDocker(endpoint, "free-name", 0, false)
	require.NoError(t, err)
	assert.True(t, unique)
}
