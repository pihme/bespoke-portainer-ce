package settings

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	dummyOAuthClientID          = "1a2b3c4d"
	dummyOAuthScopes            = "scopes"
	dummyOAuthAuthenticationURI = "example.com/auth"
	dummyOAuthRedirectURI       = "example.com/redirect"
	dummyOAuthLogoutURI         = "example.com/logout"
)

func newTestSettings() (loginURI string, settings *portainer.Settings) {
	loginURI = fmt.Sprintf("%s?response_type=code&client_id=%s&redirect_uri=%s&scope=%s",
		dummyOAuthAuthenticationURI,
		dummyOAuthClientID,
		dummyOAuthRedirectURI,
		dummyOAuthScopes)
	settings = &portainer.Settings{
		AuthenticationMethod: portainer.AuthenticationOAuth,
		OAuthSettings: portainer.OAuthSettings{
			AuthorizationURI: dummyOAuthAuthenticationURI,
			ClientID:         dummyOAuthClientID,
			Scopes:           dummyOAuthScopes,
			RedirectURI:      dummyOAuthRedirectURI,
			LogoutURI:        dummyOAuthLogoutURI,
		},
	}
	return
}

func TestGeneratePublicSettingsWithSSO(t *testing.T) {
	t.Parallel()
	dummyOAuthLoginURI, mockAppSettings := newTestSettings()

	mockAppSettings.OAuthSettings.SSO = true
	publicSettings := generatePublicSettings(mockAppSettings)
	if publicSettings.AuthenticationMethod != portainer.AuthenticationOAuth {
		t.Errorf("wrong AuthenticationMethod, want: %d, got: %d", portainer.AuthenticationOAuth, publicSettings.AuthenticationMethod)
	}

	if publicSettings.OAuthLoginURI != dummyOAuthLoginURI {
		t.Errorf("wrong OAuthLoginURI when SSO is switched on, want: %s, got: %s", dummyOAuthLoginURI, publicSettings.OAuthLoginURI)
	}

	if publicSettings.OAuthLogoutURI != dummyOAuthLogoutURI {
		t.Errorf("wrong OAuthLogoutURI, want: %s, got: %s", dummyOAuthLogoutURI, publicSettings.OAuthLogoutURI)
	}
}

func TestGeneratePublicSettingsWithoutSSO(t *testing.T) {
	t.Parallel()
	dummyOAuthLoginURI, mockAppSettings := newTestSettings()

	mockAppSettings.OAuthSettings.SSO = false
	publicSettings := generatePublicSettings(mockAppSettings)
	if publicSettings.AuthenticationMethod != portainer.AuthenticationOAuth {
		t.Errorf("wrong AuthenticationMethod, want: %d, got: %d", portainer.AuthenticationOAuth, publicSettings.AuthenticationMethod)
	}

	expectedOAuthLoginURI := dummyOAuthLoginURI + "&prompt=login"
	if publicSettings.OAuthLoginURI != expectedOAuthLoginURI {
		t.Errorf("wrong OAuthLoginURI when SSO is switched off, want: %s, got: %s", expectedOAuthLoginURI, publicSettings.OAuthLoginURI)
	}

	if publicSettings.OAuthLogoutURI != dummyOAuthLogoutURI {
		t.Errorf("wrong OAuthLogoutURI, want: %s, got: %s", dummyOAuthLogoutURI, publicSettings.OAuthLogoutURI)
	}
}

func TestREQ_SET_01_SettingsPublic_ReturnsLocalPublicFields(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	handler, _, _ := setUpHandler(t, store)
	handler.SetupTokenRequired = true

	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	settings.LogoURL = "https://example.com/public-logo.png"
	settings.AuthenticationMethod = portainer.AuthenticationInternal
	settings.InternalAuthSettings.RequiredPasswordLength = 14
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
	assert.Equal(t, portainer.AuthenticationInternal, got.AuthenticationMethod)
	assert.Equal(t, 14, got.RequiredPasswordLength)
	assert.Equal(t, "24h", got.KubeconfigExpiry)
	assert.True(t, got.RequiresSetupToken)
	assert.False(t, got.IsDockerDesktopExtension)
	assert.Empty(t, got.OAuthLoginURI)
	assert.Empty(t, got.OAuthLogoutURI)
	assert.False(t, got.TeamSync)
}

func TestREQ_SET_01_GeneratePublicSettings_InternalAuthOmitsOAuthFields(t *testing.T) {
	t.Parallel()

	settings := &portainer.Settings{
		LogoURL:              "https://example.com/logo.png",
		AuthenticationMethod: portainer.AuthenticationInternal,
		InternalAuthSettings: portainer.InternalAuthSettings{RequiredPasswordLength: 12},
		KubeconfigExpiry:     "0",
		EdgeAgentCheckinInterval: 5,
		Edge: portainer.Edge{
			PingInterval:     10,
			SnapshotInterval: 20,
			CommandInterval:  30,
		},
	}

	public := generatePublicSettings(settings)
	assert.Equal(t, "https://example.com/logo.png", public.LogoURL)
	assert.Equal(t, portainer.AuthenticationInternal, public.AuthenticationMethod)
	assert.Equal(t, 12, public.RequiredPasswordLength)
	assert.Empty(t, public.OAuthLoginURI)
	assert.Empty(t, public.OAuthLogoutURI)
	assert.False(t, public.TeamSync)
	assert.Equal(t, 10, public.Edge.PingInterval)
	assert.Equal(t, 20, public.Edge.SnapshotInterval)
	assert.Equal(t, 30, public.Edge.CommandInterval)
	assert.Equal(t, 5, public.Edge.CheckinInterval)
}
