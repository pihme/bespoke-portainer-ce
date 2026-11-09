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

func TestREQ_STK_05_StartInvalidStackID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackStartHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/abc/start?endpointId=1", nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_05_StartKubernetesStack_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackStartHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "k", Type: portainer.KubernetesStack, Status: portainer.StackStatusInactive,
	}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackStartRequest(1, 1))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_05_StartErrorStack_WithMessage_ReturnsConflictMessage(t *testing.T) {
	t.Parallel()
	h, store := newStackStartHandler(t)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Status: portainer.StackStatusError,
		DeploymentStatus: []portainer.StackDeploymentStatus{
			{Status: portainer.StackStatusError, Message: "pull failed: no such image"},
		},
	}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackStartRequest(1, 1))
	assert.Equal(t, http.StatusConflict, w.Code)
	assert.Contains(t, w.Body.String(), "Pull failed")
}

func TestREQ_STK_05_StartMissingEndpointId_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackStartHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "s", Type: portainer.DockerComposeStack, Status: portainer.StackStatusInactive,
	}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/1/start", nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_05_StartManageDisabled_NonAdmin_ReturnsForbidden(t *testing.T) {
	t.Parallel()
	h, store := newStackStartHandler(t)
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
		ID: 1, Name: "s", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID, Status: portainer.StackStatusInactive,
	}))
	url := fmt.Sprintf("/stacks/1/start?endpointId=%d", endpoint.ID)
	req := httptest.NewRequest(http.MethodPost, url, nil)
	ctx := security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		IsAdmin: false, UserID: 2, User: std,
	})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req.WithContext(ctx))
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestREQ_STK_05_StartNameCollision_ReturnsConflict(t *testing.T) {
	t.Parallel()
	h, store := newStackStartHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "dup", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID, Status: portainer.StackStatusInactive,
	}))
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 2, Name: "dup", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID, Status: portainer.StackStatusActive,
	}))
	h.ComposeStackManager = &stubComposeStackManager{}
	h.StackDeployer = &stubStackDeployer{}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, stackStartRequest(1, endpoint.ID))
	assert.Equal(t, http.StatusConflict, w.Code)
}
