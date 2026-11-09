package settings

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

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

type stubJWTService struct {
	duration time.Duration
}

func (s *stubJWTService) GenerateToken(*portainer.TokenData) (string, time.Time, error) {
	return "token", time.Now().Add(time.Hour), nil
}
func (s *stubJWTService) GenerateTokenForKubeconfig(*portainer.TokenData, portainer.EndpointID) (string, error) {
	return "kube-token", nil
}
func (s *stubJWTService) GenerateTokensForKubeconfig(*portainer.TokenData, []portainer.EndpointID) (map[portainer.EndpointID]string, error) {
	return map[portainer.EndpointID]string{}, nil
}
func (s *stubJWTService) ParseAndVerifyToken(string) (*portainer.ScopedTokenData, string, time.Time, error) {
	return &portainer.ScopedTokenData{TokenData: &portainer.TokenData{ID: 1}, Scope: portainer.DefaultTokenScope}, "jti", time.Now().Add(time.Hour), nil
}
func (s *stubJWTService) ParseAndVerifySessionToken(string) (*portainer.TokenData, string, time.Time, error) {
	return &portainer.TokenData{ID: 1}, "jti", time.Now().Add(time.Hour), nil
}
func (s *stubJWTService) SetUserSessionDuration(d time.Duration) { s.duration = d }


type failingTLSFileService struct {
	*filesystem.Service
	deleteErr error
}

func (f *failingTLSFileService) DeleteTLSFiles(folder string) error {
	if f.deleteErr != nil {
		return f.deleteErr
	}
	return f.Service.DeleteTLSFiles(folder)
}

func setUpHandler(t *testing.T, store *datastore.Store) (*Handler, *stubSnapshotService, *stubJWTService) {
	t.Helper()

	fs, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)

	snap := &stubSnapshotService{}
	jwt := &stubJWTService{}

	handler := NewHandler(testhelpers.NewTestRequestBouncer())
	handler.DataStore = store
	handler.FileService = fs
	handler.SnapshotService = snap
	handler.JWTService = jwt

	return handler, snap, jwt
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
func intPtr(v int) *int          { return &v }
func boolPtr(v bool) *bool       { return &v }

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
