package stacks

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_STK_01_ListStacks_AdminSeesComposeStacks(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{ID: 1, Name: "a", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID}))
	require.NoError(t, store.Stack().Create(&portainer.Stack{ID: 2, Name: "b", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID}))

	req := mockCreateStackRequestWithSecurityContext(http.MethodGet, "/stacks", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var stacks []portainer.Stack
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &stacks))
	assert.Len(t, stacks, 2)
}

func TestREQ_STK_01_ListStacks_FilterByEndpointID(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	ep1 := &portainer.Endpoint{ID: 1, Name: "one", SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true}}
	require.NoError(t, store.Endpoint().Create(ep1))
	ep2 := &portainer.Endpoint{ID: 2, Name: "two", SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true}}
	require.NoError(t, store.Endpoint().Create(ep2))
	require.NoError(t, store.Stack().Create(&portainer.Stack{ID: 1, Name: "on-1", Type: portainer.DockerComposeStack, EndpointID: ep1.ID}))
	require.NoError(t, store.Stack().Create(&portainer.Stack{ID: 2, Name: "on-2", Type: portainer.DockerComposeStack, EndpointID: ep2.ID}))

	filters := url.QueryEscape(`{"EndpointID":1}`)
	req := mockCreateStackRequestWithSecurityContext(http.MethodGet, "/stacks?filters="+filters, nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	var stacks []portainer.Stack
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &stacks))
	require.Len(t, stacks, 1)
	assert.Equal(t, "on-1", stacks[0].Name)
}

func TestREQ_STK_01_ListStacks_NonAdminOrphanedFlag_Forbidden(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	user := &portainer.User{ID: 2, Username: "user", Role: portainer.StandardUserRole}
	require.NoError(t, store.User().Create(user))
	_, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	filters := url.QueryEscape(`{"IncludeOrphanedStacks":true}`)
	req := httptest.NewRequest(http.MethodGet, "/stacks?filters="+filters, nil)
	req = req.WithContext(security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		IsAdmin: false, UserID: user.ID, User: user,
	}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestREQ_STK_01_ListStacks_InvalidFilters_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	req := mockCreateStackRequestWithSecurityContext(http.MethodGet, "/stacks?filters=not-json", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

