package security

import (
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

func TestRetrieveRestrictedRequestContext_RoundTrip(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	want := &RestrictedRequestContext{IsAdmin: true, UserID: 7}

	ctx := StoreRestrictedRequestContext(req, want)
	req = req.WithContext(ctx)

	got, err := RetrieveRestrictedRequestContext(req)
	require.NoError(t, err)
	require.Equal(t, want, got)
}

func TestRetrieveRestrictedRequestContext_Missing(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/", nil)

	got, err := RetrieveRestrictedRequestContext(req)
	require.Error(t, err)
	require.Nil(t, got)
	require.Contains(t, err.Error(), "security details")
}

func TestRetrieveTokenData_Missing(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/", nil)

	got, err := RetrieveTokenData(req)
	require.Error(t, err)
	require.Nil(t, got)
	require.Contains(t, err.Error(), "JWT data")
}

func TestRetrieveTokenData_RoundTrip(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	want := &portainer.TokenData{ID: 3, Role: portainer.AdministratorRole}

	ctx := StoreTokenData(req, want)
	req = req.WithContext(ctx)

	got, err := RetrieveTokenData(req)
	require.NoError(t, err)
	require.Equal(t, want, got)
}

func TestRetrieveScopedTokenData_Missing(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/", nil)

	got, err := RetrieveScopedTokenData(req)
	require.Error(t, err)
	require.Nil(t, got)
	require.Contains(t, err.Error(), "scoped JWT data")
}

func TestRetrieveScopedTokenData_RoundTrip(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	want := &portainer.ScopedTokenData{
		TokenData:  &portainer.TokenData{ID: 4},
		EndpointID: 9,
		Scope:      portainer.DefaultTokenScope,
	}

	ctx := StoreScopedTokenData(req.Context(), want)
	req = req.WithContext(ctx)

	got, err := RetrieveScopedTokenData(req)
	require.NoError(t, err)
	require.Equal(t, want, got)
}

func TestRetrieveUserFromRequest_RoundTrip(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, true)
	user := &portainer.User{ID: 11, Username: "local-admin", Role: portainer.AdministratorRole}
	require.NoError(t, store.User().Create(user))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := StoreRestrictedRequestContext(req, &RestrictedRequestContext{UserID: user.ID, IsAdmin: true})
	req = req.WithContext(ctx)

	got, err := RetrieveUserFromRequest(req, store)
	require.NoError(t, err)
	require.Equal(t, user.ID, got.ID)
	require.Equal(t, user.Username, got.Username)
}

func TestRetrieveUserFromRequest_MissingContext(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, true)
	req := httptest.NewRequest(http.MethodGet, "/", nil)

	got, err := RetrieveUserFromRequest(req, store)
	require.Error(t, err)
	require.Nil(t, got)
}

func TestRetrieveUserFromRequest_UnknownUser(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, true)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := StoreRestrictedRequestContext(req, &RestrictedRequestContext{UserID: 999})
	req = req.WithContext(ctx)

	got, err := RetrieveUserFromRequest(req, store)
	require.Error(t, err)
	require.Nil(t, got)
}

func TestIsAdmin_FromRequestToken(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := StoreTokenData(req, &portainer.TokenData{ID: 1, Role: portainer.AdministratorRole})
	req = req.WithContext(ctx)

	ok, err := IsAdmin(req)
	require.NoError(t, err)
	require.True(t, ok)
}

func TestIsAdmin_StandardUser(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := StoreTokenData(req, &portainer.TokenData{ID: 2, Role: portainer.StandardUserRole})
	req = req.WithContext(ctx)

	ok, err := IsAdmin(req)
	require.NoError(t, err)
	require.False(t, ok)
}

func TestIsAdmin_MissingToken(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/", nil)

	ok, err := IsAdmin(req)
	require.Error(t, err)
	require.False(t, ok)
}

func TestIsAdminRole(t *testing.T) {
	t.Parallel()

	require.True(t, IsAdminRole(portainer.AdministratorRole))
	require.False(t, IsAdminRole(portainer.StandardUserRole))
}
