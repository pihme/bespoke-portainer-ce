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

func TestREQ_SET_01_SettingsUpdatePayload_Validate(t *testing.T) {
	t.Parallel()

	t.Run("accepts local docker settings payload", func(t *testing.T) {
		t.Parallel()
		payload := &settingsUpdatePayload{
			LogoURL:            stringPtr("https://example.com/logo.png"),
			TemplatesURL:       stringPtr("https://example.com/templates.json"),
			SnapshotInterval:   stringPtr("10m"),
			KubeconfigExpiry:   stringPtr("24h"),
			ForceSecureCookies: boolPtr(true),
			HelmRepositoryURL:  stringPtr(""),
			KubectlShellImage:  stringPtr("portainer/kubectl-shell:latest"),
		}
		require.NoError(t, payload.Validate(httptest.NewRequest(http.MethodPut, "/settings", nil)))
	})

	t.Run("rejects invalid logo URL", func(t *testing.T) {
		t.Parallel()
		payload := &settingsUpdatePayload{LogoURL: stringPtr("not a url")}
		require.EqualError(t, payload.Validate(nil), "Invalid logo URL. Must correspond to a valid URL format")
	})

	t.Run("rejects invalid templates URL", func(t *testing.T) {
		t.Parallel()
		payload := &settingsUpdatePayload{TemplatesURL: stringPtr("://bad")}
		require.EqualError(t, payload.Validate(nil), "Invalid external templates URL. Must correspond to a valid URL format")
	})

	t.Run("rejects invalid helm repository URL", func(t *testing.T) {
		t.Parallel()
		payload := &settingsUpdatePayload{HelmRepositoryURL: stringPtr("not a url")}
		req := httptest.NewRequest(http.MethodPut, "/settings", nil)
		require.EqualError(t, payload.Validate(req), "Invalid Helm repository URL. Must correspond to a valid URL format")
	})

	t.Run("rejects invalid kubeconfig expiry", func(t *testing.T) {
		t.Parallel()
		payload := &settingsUpdatePayload{KubeconfigExpiry: stringPtr("nope")}
		require.EqualError(t, payload.Validate(nil), "Invalid Kubeconfig Expiry")
	})

	t.Run("empty logo and templates URLs are allowed", func(t *testing.T) {
		t.Parallel()
		payload := &settingsUpdatePayload{
			LogoURL:      stringPtr(""),
			TemplatesURL: stringPtr(""),
		}
		require.NoError(t, payload.Validate(nil))
	})
}

func TestREQ_SET_01_SettingsUpdate_LogoTemplatesAndSnapshot(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	handler, snap := setUpHandler(t, store)

	req := withAdminContext(jsonRequest(t, http.MethodPut, "/settings", settingsUpdatePayload{
		LogoURL:          stringPtr("https://mycompany.example/logo.svg"),
		TemplatesURL:     stringPtr("https://mycompany.example/templates.json"),
		SnapshotInterval: stringPtr("15m"),
	}))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var got portainer.Settings
	require.NoError(t, json.NewDecoder(w.Body).Decode(&got))
	assert.Equal(t, "https://mycompany.example/logo.svg", got.LogoURL)
	assert.Equal(t, "https://mycompany.example/templates.json", got.TemplatesURL)
	assert.Equal(t, "15m", got.SnapshotInterval)
	assert.Equal(t, portainer.AuthenticationInternal, got.AuthenticationMethod)
	assert.Equal(t, "15m", snap.interval)

	persisted, err := store.Settings().Settings()
	require.NoError(t, err)
	assert.Equal(t, "https://mycompany.example/logo.svg", persisted.LogoURL)
	assert.Equal(t, "15m", persisted.SnapshotInterval)
}

func TestREQ_DED_04_SettingsUpdate_AcceptsAnyParseableSnapshotInterval(t *testing.T) {
	t.Parallel()

	cases := []string{"0s", "1s", "5m", "1h", "24h"}
	for _, interval := range cases {
		interval := interval
		t.Run(interval, func(t *testing.T) {
			t.Parallel()
			_, store := datastore.MustNewTestStore(t, true, false)
			handler, snap := setUpHandler(t, store)

			before, err := store.Settings().Settings()
			require.NoError(t, err)

			req := withAdminContext(jsonRequest(t, http.MethodPut, "/settings", settingsUpdatePayload{
				SnapshotInterval: stringPtr(interval),
			}))
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			require.Equal(t, http.StatusOK, w.Code, w.Body.String())
			if interval != before.SnapshotInterval {
				assert.Equal(t, interval, snap.interval)
			} else {
				assert.Empty(t, snap.interval)
			}

			persisted, err := store.Settings().Settings()
			require.NoError(t, err)
			assert.Equal(t, interval, persisted.SnapshotInterval)
		})
	}
}

func TestREQ_SET_02_SettingsUpdate_BlackListedLabels(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	handler, _ := setUpHandler(t, store)

	labels := []portainer.Pair{{Name: "com.docker.compose.project", Value: "hidden"}}
	req := withAdminContext(jsonRequest(t, http.MethodPut, "/settings", settingsUpdatePayload{
		BlackListedLabels: labels,
	}))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var got portainer.Settings
	require.NoError(t, json.NewDecoder(w.Body).Decode(&got))
	assert.Equal(t, labels, got.BlackListedLabels)

	persisted, err := store.Settings().Settings()
	require.NoError(t, err)
	assert.Equal(t, labels, persisted.BlackListedLabels)
}

func TestREQ_SET_04_SettingsUpdate_ForceSecureCookies(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	handler, _ := setUpHandler(t, store)

	req := withAdminContext(jsonRequest(t, http.MethodPut, "/settings", settingsUpdatePayload{
		ForceSecureCookies: boolPtr(true),
	}))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	persisted, err := store.Settings().Settings()
	require.NoError(t, err)
	assert.True(t, persisted.ForceSecureCookies)
}

func TestREQ_SET_01_SettingsUpdate_HelmDefault(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	handler, _ := setUpHandler(t, store)

	req := withAdminContext(jsonRequest(t, http.MethodPut, "/settings", settingsUpdatePayload{
		HelmRepositoryURL: stringPtr(portainer.DefaultHelmRepositoryURL),
		KubectlShellImage: stringPtr("portainer/kubectl-shell:test"),
		KubeconfigExpiry:  stringPtr("12h"),
		GlobalDeploymentOptions: &portainer.GlobalDeploymentOptions{
			HideStacksFunctionality: true,
		},
	}))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	persisted, err := store.Settings().Settings()
	require.NoError(t, err)
	assert.Equal(t, portainer.DefaultHelmRepositoryURL, persisted.HelmRepositoryURL)
	assert.Equal(t, "portainer/kubectl-shell:test", persisted.KubectlShellImage)
	assert.Equal(t, "12h", persisted.KubeconfigExpiry)
	assert.True(t, persisted.GlobalDeploymentOptions.HideStacksFunctionality)
}

func TestREQ_SET_01_SettingsUpdate_ClearsHelmRepositoryURL(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	handler, _ := setUpHandler(t, store)

	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	settings.HelmRepositoryURL = "https://charts.example.com/old"
	require.NoError(t, store.Settings().UpdateSettings(settings))

	req := withAdminContext(jsonRequest(t, http.MethodPut, "/settings", settingsUpdatePayload{
		HelmRepositoryURL: stringPtr(""),
	}))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	persisted, err := store.Settings().Settings()
	require.NoError(t, err)
	assert.Empty(t, persisted.HelmRepositoryURL)
}

func TestREQ_SET_01_SettingsUpdate_InvalidJSON_ReturnsBadRequest(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	handler, _ := setUpHandler(t, store)

	req := withAdminContext(jsonRequest(t, http.MethodPut, "/settings", []byte(`{`)))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_SET_01_SettingsUpdate_InvalidLogo_ReturnsBadRequest(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	handler, _ := setUpHandler(t, store)

	req := withAdminContext(jsonRequest(t, http.MethodPut, "/settings", settingsUpdatePayload{
		LogoURL: stringPtr("not a url"),
	}))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_DED_04_SettingsUpdate_SnapshotServiceError(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	handler, snap := setUpHandler(t, store)
	snap.err = assert.AnError

	req := withAdminContext(jsonRequest(t, http.MethodPut, "/settings", settingsUpdatePayload{
		SnapshotInterval: stringPtr("30m"),
	}))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusOK, w.Code)
}

func TestREQ_SET_01_SettingsUpdate_UnchangedSnapshotInterval_SkipsService(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	handler, snap := setUpHandler(t, store)

	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	current := settings.SnapshotInterval

	req := withAdminContext(jsonRequest(t, http.MethodPut, "/settings", settingsUpdatePayload{
		SnapshotInterval: stringPtr(current),
		LogoURL:          stringPtr("https://example.com/same-interval.png"),
	}))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	assert.Empty(t, snap.interval, "SetSnapshotInterval must not run when interval is unchanged")
}

// TAI-001: PUT /settings no longer changes the login method, LDAP, OAuth,
// password policy or session lifetime; those fields are ignored.
func TestREQ_TAI_001_SettingsUpdate_IgnoresLoginFields(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	handler, _ := setUpHandler(t, store)

	before, err := store.Settings().Settings()
	require.NoError(t, err)

	body := []byte(`{
		"AuthenticationMethod": 3,
		"InternalAuthSettings": {"RequiredPasswordLength": 3},
		"LDAPSettings": {"URL": "ldap.example.com:389", "ReaderDN": "cn=reader"},
		"OAuthSettings": {"ClientID": "client", "AuthorizationURI": "https://oauth.example.com"},
		"UserSessionTimeout": "1m"
	}`)

	req := withAdminContext(jsonRequest(t, http.MethodPut, "/settings", body))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	after, err := store.Settings().Settings()
	require.NoError(t, err)
	assert.Equal(t, before.AuthenticationMethod, after.AuthenticationMethod)
	assert.Equal(t, before.InternalAuthSettings, after.InternalAuthSettings)
	assert.Equal(t, before.LDAPSettings.URL, after.LDAPSettings.URL)
	assert.Equal(t, before.OAuthSettings.ClientID, after.OAuthSettings.ClientID)
	assert.Equal(t, before.UserSessionTimeout, after.UserSessionTimeout)
}
