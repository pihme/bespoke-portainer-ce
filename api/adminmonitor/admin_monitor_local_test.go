package adminmonitor

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	i "github.com/portainer/portainer/api/internal/testhelpers"

	"github.com/stretchr/testify/require"
)

type userErrStore struct {
	dataservices.DataStore
	user dataservices.UserService
}

func (s userErrStore) User() dataservices.UserService { return s.user }

type userErrService struct {
	dataservices.UserService
	err error
}

func (s userErrService) UsersByRole(role portainer.UserRole) ([]portainer.User, error) {
	return nil, s.err
}

func TestStartIsIdempotentWhenAlreadyRunning(t *testing.T) {
	t.Parallel()
	monitor := New(time.Minute, i.NewDatastore(i.WithUsers(nil)))
	monitor.Start(t.Context())
	require.NotNil(t, monitor.cancellationFunc)
	monitor.Start(t.Context())
	require.NotNil(t, monitor.cancellationFunc)
	monitor.Stop()
}

func TestWasInitializedError(t *testing.T) {
	t.Parallel()
	base := i.NewDatastore(i.WithUsers(nil))
	wantErr := errors.New("user list boom")
	monitor := New(time.Minute, userErrStore{
		DataStore: base,
		user: userErrService{
			UserService: base.User(),
			err:         wantErr,
		},
	})
	ok, err := monitor.WasInitialized()
	require.ErrorIs(t, err, wantErr)
	require.False(t, ok)
}

func TestStartLogsInitializedErrorWithoutDisabling(t *testing.T) {
	t.Parallel()
	base := i.NewDatastore(i.WithUsers(nil))
	wantErr := errors.New("user list boom")
	monitor := New(5*time.Millisecond, userErrStore{
		DataStore: base,
		user: userErrService{
			UserService: base.User(),
			err:         wantErr,
		},
	})
	monitor.Start(t.Context())
	time.Sleep(30 * time.Millisecond)
	require.False(t, monitor.WasInstanceDisabled())
	monitor.Stop()
}

func TestWasInitializedTrueWhenAdminExists(t *testing.T) {
	t.Parallel()
	monitor := New(time.Minute, i.NewDatastore(i.WithUsers([]portainer.User{
		{ID: 1, Role: portainer.AdministratorRole},
	})))
	ok, err := monitor.WasInitialized()
	require.NoError(t, err)
	require.True(t, ok)
}

func TestWithRedirectPassesThroughWhenActive(t *testing.T) {
	t.Parallel()
	monitor := New(time.Minute, i.NewDatastore(i.WithUsers(nil)))
	called := false
	handler := monitor.WithRedirect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/endpoints", nil)
	req.RequestURI = "/api/endpoints"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	require.True(t, called)
	require.Equal(t, http.StatusNoContent, rec.Code)
}

func TestWithRedirectBlocksAPIWhenDisabled(t *testing.T) {
	t.Parallel()
	monitor := New(time.Minute, i.NewDatastore(i.WithUsers(nil)))
	monitor.adminInitDisabled = true

	called := false
	handler := monitor.WithRedirect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/endpoints", nil)
	req.RequestURI = "/api/endpoints"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	require.False(t, called)
	require.Equal(t, http.StatusSeeOther, rec.Code)
	require.Equal(t, RedirectReasonAdminInitTimeout, rec.Header().Get("redirect-reason"))
}

func TestWithRedirectAllowsStatusAndPublicSettingsWhenDisabled(t *testing.T) {
	t.Parallel()
	monitor := New(time.Minute, i.NewDatastore(i.WithUsers(nil)))
	monitor.adminInitDisabled = true

	handler := monitor.WithRedirect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for _, path := range []string{"/api/status", "/api/settings/public", "/"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.RequestURI = path
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		require.Equal(t, http.StatusOK, rec.Code, path)
		require.Empty(t, rec.Header().Get("redirect-reason"), path)
	}
}
