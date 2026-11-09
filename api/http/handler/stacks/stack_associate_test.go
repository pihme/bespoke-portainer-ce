package stacks

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/api/stacks/stackutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newStackAssociateHandler(t *testing.T) (*Handler, *datastore.Store) {
	t.Helper()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	return h, store
}

func TestREQ_STK_10_AssociateOrphanedComposeStack_ToEndpoint(t *testing.T) {
	t.Parallel()
	h, store := newStackAssociateHandler(t)
	user, err := mockCreateUser(store)
	require.NoError(t, err)

	oldEndpoint := &portainer.Endpoint{ID: 1, Name: "old", SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true}}
	require.NoError(t, store.Endpoint().Create(oldEndpoint))
	newEndpoint := &portainer.Endpoint{ID: 2, Name: "new", SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true}}
	require.NoError(t, store.Endpoint().Create(newEndpoint))

	stack := &portainer.Stack{
		ID:         3,
		EndpointID: oldEndpoint.ID,
		Type:       portainer.DockerComposeStack,
		Name:       "orphaned-compose",
		Status:     portainer.StackStatusInactive,
	}
	require.NoError(t, store.Stack().Create(stack))

	url := "/stacks/" + strconv.Itoa(int(stack.ID)) + "/associate?endpointId=" + strconv.Itoa(int(newEndpoint.ID)) + "&orphanedRunning=true"
	req := mockCreateStackRequestWithSecurityContext(http.MethodPut, url, nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, newEndpoint.ID, updated.EndpointID)
	assert.Equal(t, portainer.StackStatusActive, updated.Status)
	assert.Equal(t, user.Username, updated.CreatedBy)
	assert.NotZero(t, updated.CreationDate)

	var body portainer.Stack
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, newEndpoint.ID, body.EndpointID)
	assert.Equal(t, portainer.StackStatusActive, body.Status)
}

func TestREQ_STK_10_AssociateOrphanedComposeStack_NotRunning_SetsInactive(t *testing.T) {
	t.Parallel()
	h, store := newStackAssociateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)

	oldEndpoint := &portainer.Endpoint{ID: 1, Name: "old", SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true}}
	require.NoError(t, store.Endpoint().Create(oldEndpoint))
	newEndpoint := &portainer.Endpoint{ID: 2, Name: "new", SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true}}
	require.NoError(t, store.Endpoint().Create(newEndpoint))

	stack := &portainer.Stack{
		ID:         4,
		EndpointID: oldEndpoint.ID,
		Type:       portainer.DockerComposeStack,
		Name:       "orphaned-stopped",
		Status:     portainer.StackStatusActive,
	}
	require.NoError(t, store.Stack().Create(stack))

	url := "/stacks/" + strconv.Itoa(int(stack.ID)) + "/associate?endpointId=" + strconv.Itoa(int(newEndpoint.ID)) + "&orphanedRunning=false"
	req := mockCreateStackRequestWithSecurityContext(http.MethodPut, url, nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, newEndpoint.ID, updated.EndpointID)
	assert.Equal(t, portainer.StackStatusInactive, updated.Status)
}

func TestREQ_STK_10_AssociateUpdatesResourceControlID(t *testing.T) {
	t.Parallel()
	h, store := newStackAssociateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)

	oldEndpoint := &portainer.Endpoint{ID: 1, Name: "old", SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true}}
	require.NoError(t, store.Endpoint().Create(oldEndpoint))
	newEndpoint := &portainer.Endpoint{ID: 2, Name: "new", SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true}}
	require.NoError(t, store.Endpoint().Create(newEndpoint))

	stack := &portainer.Stack{
		ID:         5,
		EndpointID: oldEndpoint.ID,
		Type:       portainer.DockerComposeStack,
		Name:       "with-rc",
		Status:     portainer.StackStatusInactive,
	}
	require.NoError(t, store.Stack().Create(stack))
	rc := &portainer.ResourceControl{
		ResourceID: stackutils.ResourceControlID(oldEndpoint.ID, stack.Name),
		Type:       portainer.StackResourceControl,
		Public:     true,
	}
	require.NoError(t, store.ResourceControl().Create(rc))

	url := "/stacks/" + strconv.Itoa(int(stack.ID)) + "/associate?endpointId=" + strconv.Itoa(int(newEndpoint.ID)) + "&orphanedRunning=false"
	req := mockCreateStackRequestWithSecurityContext(http.MethodPut, url, nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	updatedRC, err := store.ResourceControl().Read(rc.ID)
	require.NoError(t, err)
	assert.Equal(t, stackutils.ResourceControlID(newEndpoint.ID, stack.Name), updatedRC.ResourceID)
}

func TestREQ_STK_10_AssociateMissingStack_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, store := newStackAssociateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	url := "/stacks/99/associate?endpointId=" + strconv.Itoa(int(endpoint.ID)) + "&orphanedRunning=false"
	req := mockCreateStackRequestWithSecurityContext(http.MethodPut, url, nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_TAI_003_AssociateSwarmStackIsRejected(t *testing.T) {
	t.Parallel()
	h, store := newStackAssociateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)

	oldEndpoint := &portainer.Endpoint{ID: 1, Name: "old", SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true}}
	require.NoError(t, store.Endpoint().Create(oldEndpoint))
	newEndpoint := &portainer.Endpoint{ID: 2, Name: "new", SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true}}
	require.NoError(t, store.Endpoint().Create(newEndpoint))

	stack := &portainer.Stack{
		ID:         6,
		EndpointID: oldEndpoint.ID,
		Type:       portainer.DockerSwarmStack,
		Name:       "legacy-swarm",
		SwarmID:    "swarm-1",
		Status:     portainer.StackStatusInactive,
	}
	require.NoError(t, store.Stack().Create(stack))

	url := "/stacks/" + strconv.Itoa(int(stack.ID)) + "/associate?endpointId=" + strconv.Itoa(int(newEndpoint.ID)) + "&swarmId=swarm-2&orphanedRunning=true"
	req := mockCreateStackRequestWithSecurityContext(http.MethodPut, url, nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "Docker Swarm")

	unchanged, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, oldEndpoint.ID, unchanged.EndpointID)
	assert.Equal(t, "swarm-1", unchanged.SwarmID)
}
