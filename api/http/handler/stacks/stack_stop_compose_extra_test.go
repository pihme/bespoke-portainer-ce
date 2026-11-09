package stacks

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_STK_05_StopInvalidStackID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackStopHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/abc/stop?endpointId=1", nil))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_05_StopMissingEndpoint_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, store := newStackStopHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "s", Type: portainer.DockerComposeStack, Status: portainer.StackStatusActive, EndpointID: 1,
	}))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/1/stop?endpointId=99", nil))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_05_StopManageDisabled_NonAdmin_ReturnsForbidden(t *testing.T) {
	t.Parallel()
	h, store := newStackStopHandler(t)
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
		ID: 1, Name: "s", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID, Status: portainer.StackStatusActive,
	}))
	url := fmt.Sprintf("/stacks/1/stop?endpointId=%d", endpoint.ID)
	req := httptest.NewRequest(http.MethodPost, url, nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req.WithContext(securityStoreNonAdmin(req, std)))
	assert.Equal(t, http.StatusForbidden, w.Code)
}

