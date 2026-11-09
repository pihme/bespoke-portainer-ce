package endpoints

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func boolPtr(v bool) *bool { return &v }

func TestREQ_HOST_04_SettingsUpdate_PersistsSecurityAndGPU(t *testing.T) {
	t.Parallel()
	h, store := newDockerEndpointHandler(t)
	createDockerEndpoint(t, store, 1, "local")

	payload := endpointSettingsUpdatePayload{
		AllowBindMountsForRegularUsers:            boolPtr(false),
		AllowPrivilegedModeForRegularUsers:        boolPtr(false),
		AllowVolumeBrowserForRegularUsers:         boolPtr(true),
		AllowHostNamespaceForRegularUsers:         boolPtr(false),
		AllowDeviceMappingForRegularUsers:         boolPtr(false),
		AllowStackManagementForRegularUsers:       boolPtr(false),
		AllowContainerCapabilitiesForRegularUsers: boolPtr(true),
		AllowSysctlSettingForRegularUsers:         boolPtr(false),
		AllowSecurityOptForRegularUsers:           boolPtr(false),
		EnableHostManagementFeatures:              boolPtr(true),
		EnableGPUManagement:                       boolPtr(true),
		Gpus:                                      []portainer.Pair{{Name: "gpu0", Value: "nvidia.com/gpu=0"}},
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/1/settings", body))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	updated, err := store.Endpoint().Endpoint(1)
	require.NoError(t, err)
	assert.False(t, updated.SecuritySettings.AllowBindMountsForRegularUsers)
	assert.False(t, updated.SecuritySettings.AllowPrivilegedModeForRegularUsers)
	assert.True(t, updated.SecuritySettings.AllowVolumeBrowserForRegularUsers)
	assert.False(t, updated.SecuritySettings.AllowStackManagementForRegularUsers)
	assert.True(t, updated.SecuritySettings.EnableHostManagementFeatures)
	assert.True(t, updated.EnableGPUManagement)
	assert.Equal(t, []portainer.Pair{{Name: "gpu0", Value: "nvidia.com/gpu=0"}}, updated.Gpus)
}

func TestREQ_HOST_04_SettingsUpdate_MissingEndpoint_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	h, _ := newDockerEndpointHandler(t)
	body, _ := json.Marshal(endpointSettingsUpdatePayload{AllowBindMountsForRegularUsers: boolPtr(true)})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/99/settings", body))
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_HOST_04_SettingsUpdate_InvalidID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, _ := newDockerEndpointHandler(t)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, endpointAdminRequest(http.MethodPut, "/endpoints/abc/settings", []byte(`{}`)))
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_HOST_04_SettingsUpdatePayload_Validate_OK(t *testing.T) {
	t.Parallel()
	payload := &endpointSettingsUpdatePayload{}
	require.NoError(t, payload.Validate(nil))
}
