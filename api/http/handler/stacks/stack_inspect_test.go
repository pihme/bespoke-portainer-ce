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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func stackInspectRequest(stackID portainer.StackID) *http.Request {
	url := "/stacks/" + strconv.Itoa(int(stackID))
	return mockCreateStackRequestWithSecurityContext(http.MethodGet, url, nil)
}

func newStackInspectHandler(t *testing.T) (*Handler, *datastore.Store) {
	t.Helper()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	return h, store
}

func TestREQ_STK_01_InspectComposeStack_ReturnsStack(t *testing.T) {
	t.Parallel()
	h, store := newStackInspectHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	stack := &portainer.Stack{
		ID:         7,
		EndpointID: endpoint.ID,
		Type:       portainer.DockerComposeStack,
		Name:       "inspect-me",
		Status:     portainer.StackStatusActive,
	}
	require.NoError(t, store.Stack().Create(stack))

	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackInspectRequest(stack.ID))

	require.Equal(t, http.StatusOK, w.Code)
	var body stackResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, stack.ID, body.ID)
	assert.Equal(t, stack.Name, body.Name)
	assert.Equal(t, portainer.DockerComposeStack, body.Type)
	assert.Equal(t, portainer.StackStatusActive, body.Status)
	assert.Equal(t, endpoint.ID, body.EndpointID)
	assert.Zero(t, body.GitSourceId)
}

func TestREQ_STK_01_InspectMissingStack_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, store := newStackInspectHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	_, err = mockCreateEndpoint(store)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackInspectRequest(404))

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_01_InspectInvalidStackID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, _ := newStackInspectHandler(t)

	req := mockCreateStackRequestWithSecurityContext(http.MethodGet, "/stacks/not-a-number", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
