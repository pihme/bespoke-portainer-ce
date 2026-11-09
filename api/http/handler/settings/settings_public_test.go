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

func TestREQ_SET_01_SettingsPublic_ReturnsLocalPublicFields(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	handler, _ := setUpHandler(t, store)

	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	settings.LogoURL = "https://example.com/public-logo.png"
	settings.KubeconfigExpiry = "24h"
	settings.IsDockerDesktopExtension = false
	require.NoError(t, store.Settings().UpdateSettings(settings))

	req := jsonRequest(t, http.MethodGet, "/settings/public", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var got publicSettingsResponse
	require.NoError(t, json.NewDecoder(w.Body).Decode(&got))
	assert.Equal(t, "https://example.com/public-logo.png", got.LogoURL)
	assert.Equal(t, "24h", got.KubeconfigExpiry)
	assert.False(t, got.IsDockerDesktopExtension)
}

func TestREQ_SET_01_GeneratePublicSettings_LocalFields(t *testing.T) {
	t.Parallel()

	settings := &portainer.Settings{
		LogoURL:                  "https://example.com/logo.png",
		KubeconfigExpiry:         "0",
		EdgeAgentCheckinInterval: 5,
		Edge: portainer.Edge{
			PingInterval:     10,
			SnapshotInterval: 20,
			CommandInterval:  30,
		},
	}

	public := generatePublicSettings(settings)
	assert.Equal(t, "https://example.com/logo.png", public.LogoURL)
	assert.Equal(t, 10, public.Edge.PingInterval)
	assert.Equal(t, 20, public.Edge.SnapshotInterval)
	assert.Equal(t, 30, public.Edge.CommandInterval)
	assert.Equal(t, 5, public.Edge.CheckinInterval)
}

// TAI-001: the public settings no longer announce a login method, OAuth URLs,
// a password policy, team sync or a setup-token requirement.
func TestREQ_TAI_001_SettingsPublic_HasNoLoginFields(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	handler, _ := setUpHandler(t, store)

	req := jsonRequest(t, http.MethodGet, "/settings/public", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var got map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&got))

	for _, key := range []string{"AuthenticationMethod", "RequiredPasswordLength", "OAuthLoginURI", "OAuthLogoutURI", "TeamSync", "RequiresSetupToken"} {
		assert.NotContains(t, got, key)
	}
	assert.Contains(t, got, "LogoURL")
}
