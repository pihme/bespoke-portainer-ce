package settings

import (
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_SET_01_SettingsInspect_ReturnsLocalSettingsAndHidesSecrets(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	handler, _, _ := setUpHandler(t, store)
	seedSettingsSecrets(t, store)

	req := withAdminContext(jsonRequest(t, http.MethodGet, "/settings", nil))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var got portainer.Settings
	require.NoError(t, json.NewDecoder(w.Body).Decode(&got))
	assert.Equal(t, "https://example.com/logo.png", got.LogoURL)
	assert.Equal(t, "5m", got.SnapshotInterval)
	assert.Equal(t, portainer.AuthenticationInternal, got.AuthenticationMethod)
	assert.Equal(t, 12, got.InternalAuthSettings.RequiredPasswordLength)
	assert.Empty(t, got.LDAPSettings.Password)
	assert.Empty(t, got.OAuthSettings.ClientSecret)
	assert.Nil(t, got.OAuthSettings.KubeSecretKey)
}

func TestHideFields_ClearsSensitiveValues(t *testing.T) {
	t.Parallel()

	settings := &portainer.Settings{
		LDAPSettings:  portainer.LDAPSettings{Password: "keep-secret"},
		OAuthSettings: portainer.OAuthSettings{ClientSecret: "oauth", KubeSecretKey: []byte("k")},
	}
	hideFields(settings)
	assert.Empty(t, settings.LDAPSettings.Password)
	assert.Empty(t, settings.OAuthSettings.ClientSecret)
	assert.Nil(t, settings.OAuthSettings.KubeSecretKey)
}
