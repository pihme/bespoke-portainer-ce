package settings

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/require"
)

type stubSnapshotService struct {
	interval string
	err      error
}

func (s *stubSnapshotService) Start(context.Context) {}
func (s *stubSnapshotService) SetSnapshotInterval(snapshotInterval string) error {
	s.interval = snapshotInterval
	return s.err
}
func (s *stubSnapshotService) SnapshotEndpoint(*portainer.Endpoint) error { return nil }
func (s *stubSnapshotService) FillSnapshotData(*portainer.Endpoint, bool) error {
	return nil
}

func setUpHandler(t *testing.T, store *datastore.Store) (*Handler, *stubSnapshotService) {
	t.Helper()

	fs, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)

	snap := &stubSnapshotService{}

	handler := NewHandler(testhelpers.NewTestRequestBouncer())
	handler.DataStore = store
	handler.FileService = fs
	handler.SnapshotService = snap

	return handler, snap
}

func withAdminContext(r *http.Request) *http.Request {
	return r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{
		UserID:  1,
		IsAdmin: true,
		User:    &portainer.User{ID: 1, Role: portainer.AdministratorRole},
	}))
}

func jsonRequest(t *testing.T, method, path string, payload any) *http.Request {
	t.Helper()
	var body *bytes.Reader
	switch v := payload.(type) {
	case nil:
		body = bytes.NewReader(nil)
	case []byte:
		body = bytes.NewReader(v)
	default:
		b, err := json.Marshal(v)
		require.NoError(t, err)
		body = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, path, body)
	req.Header.Set("Content-Type", "application/json")
	return req
}

func stringPtr(v string) *string { return &v }

func boolPtr(v bool) *bool { return &v }

func seedSettingsSecrets(t *testing.T, store *datastore.Store) {
	t.Helper()
	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	settings.LDAPSettings.Password = "ldap-secret"
	settings.OAuthSettings.ClientSecret = "oauth-secret"
	settings.OAuthSettings.KubeSecretKey = []byte("kube-secret")
	settings.LogoURL = "https://example.com/logo.png"
	settings.SnapshotInterval = "5m"
	settings.AuthenticationMethod = portainer.AuthenticationInternal
	settings.InternalAuthSettings.RequiredPasswordLength = 12
	require.NoError(t, store.Settings().UpdateSettings(settings))
}

func TestNewHandler_RegistersSettingsRoutes(t *testing.T) {
	t.Parallel()
	handler := NewHandler(testhelpers.NewTestRequestBouncer())
	require.NotNil(t, handler)
	require.NotNil(t, handler.Router)
}
