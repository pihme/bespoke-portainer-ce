package stacks

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/pkg/errors"
	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	dockerclient "github.com/portainer/portainer/api/docker/client"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/api/stacks/deployments"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubStopStackDeployer struct {
	deployments.StackDeployer
	undeployErr     error
	composeStopped  bool
	undeployCalls   int
}

func (s *stubStopStackDeployer) GetDockerClientFactory() *dockerclient.ClientFactory {
	return nil
}

func (s *stubStopStackDeployer) UndeployComposeStack(_ context.Context, _ *portainer.Stack, _ *portainer.Endpoint) error {
	s.undeployCalls++
	s.composeStopped = true
	return s.undeployErr
}

func stackStopRequest(stackID portainer.StackID, endpointID portainer.EndpointID) *http.Request {
	url := "/stacks/" + strconv.Itoa(int(stackID)) + "/stop?endpointId=" + strconv.Itoa(int(endpointID))
	return mockCreateStackRequestWithSecurityContext(http.MethodPost, url, nil)
}

func newStackStopHandler(t *testing.T) (*Handler, *datastore.Store) {
	t.Helper()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	return h, store
}

func newStoppableComposeStack(endpointID portainer.EndpointID) *portainer.Stack {
	return &portainer.Stack{
		ID:         1,
		EndpointID: endpointID,
		Type:       portainer.DockerComposeStack,
		Name:       "test-stack",
		Status:     portainer.StackStatusActive,
	}
}

func TestREQ_STK_05_StopInactiveComposeStack_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackStopHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	stack := newStoppableComposeStack(endpoint.ID)
	stack.Status = portainer.StackStatusInactive
	require.NoError(t, store.Stack().Create(stack))
	h.ComposeStackManager = &stubComposeStackManager{}
	h.StackDeployer = &stubStopStackDeployer{}

	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackStopRequest(stack.ID, endpoint.ID))

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_05_StopDeployingComposeStack_ReturnsConflict(t *testing.T) {
	t.Parallel()
	h, store := newStackStopHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	stack := newStoppableComposeStack(endpoint.ID)
	stack.Status = portainer.StackStatusDeploying
	require.NoError(t, store.Stack().Create(stack))
	h.ComposeStackManager = &stubComposeStackManager{}
	h.StackDeployer = &stubStopStackDeployer{}

	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackStopRequest(stack.ID, endpoint.ID))

	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestREQ_STK_05_StopKubernetesStack_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackStopHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	stack := &portainer.Stack{
		ID:         1,
		EndpointID: endpoint.ID,
		Type:       portainer.KubernetesStack,
		Name:       "k8s-stack",
		Status:     portainer.StackStatusActive,
	}
	require.NoError(t, store.Stack().Create(stack))

	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackStopRequest(stack.ID, endpoint.ID))

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_05_StopComposeStackSuccess_SetsInactive(t *testing.T) {
	t.Parallel()
	h, store := newStackStopHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	stack := newStoppableComposeStack(endpoint.ID)
	require.NoError(t, store.Stack().Create(stack))
	deployer := &stubStopStackDeployer{}
	h.ComposeStackManager = &stubComposeStackManager{}
	h.StackDeployer = deployer

	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackStopRequest(stack.ID, endpoint.ID))

	require.Equal(t, http.StatusOK, w.Code)
	assert.True(t, deployer.composeStopped)
	assert.Equal(t, 1, deployer.undeployCalls)

	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, portainer.StackStatusInactive, updated.Status)
	require.NotEmpty(t, updated.DeploymentStatus)
	assert.Equal(t, portainer.StackStatusInactive, updated.DeploymentStatus[0].Status)

	var body portainer.Stack
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, stack.ID, body.ID)
	assert.Equal(t, portainer.StackStatusInactive, body.Status)
}

func TestREQ_STK_05_StopComposeStackFailure_SetsErrorStatus(t *testing.T) {
	t.Parallel()
	stopErr := errors.New("compose down failed")
	h, store := newStackStopHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	stack := newStoppableComposeStack(endpoint.ID)
	require.NoError(t, store.Stack().Create(stack))
	h.ComposeStackManager = &stubComposeStackManager{}
	h.StackDeployer = &stubStopStackDeployer{undeployErr: stopErr}

	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackStopRequest(stack.ID, endpoint.ID))

	require.Equal(t, http.StatusInternalServerError, w.Code)
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, portainer.StackStatusError, updated.Status)
	require.NotEmpty(t, updated.DeploymentStatus)
	assert.Equal(t, portainer.StackStatusError, updated.DeploymentStatus[0].Status)
	assert.Equal(t, stopErr.Error(), updated.DeploymentStatus[0].Message)
}

func TestREQ_STK_05_StopMissingStack_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, store := newStackStopHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackStopRequest(99, endpoint.ID))

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_05_StopMissingEndpointId_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackStopHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	stack := newStoppableComposeStack(endpoint.ID)
	require.NoError(t, store.Stack().Create(stack))

	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/1/stop", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
