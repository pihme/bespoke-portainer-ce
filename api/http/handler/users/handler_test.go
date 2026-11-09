package users

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/require"
)

func newOperatorHandler(t *testing.T) (*Handler, *portainer.User) {
	t.Helper()
	_, store := datastore.MustNewTestStore(t, true, false)

	operator := &portainer.User{
		Username: security.LocalOperatorUsername,
		Role:     portainer.AdministratorRole,
		Password: "should-never-leak",
	}
	require.NoError(t, store.User().Create(operator))
	require.NoError(t, store.User().Create(&portainer.User{Username: "legacy", Role: portainer.StandardUserRole}))

	h := NewHandler(testhelpers.NewTestRequestBouncer())
	h.DataStore = store

	return h, operator
}

func asOperator(req *http.Request, operator *portainer.User) *http.Request {
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{ID: operator.ID, Username: operator.Username, Role: operator.Role}))
	req = req.WithContext(security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		IsAdmin: true,
		UserID:  operator.ID,
		User:    operator,
	}))

	return req
}

func serve(h *Handler, req *http.Request) *httptest.ResponseRecorder {
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	return rr
}

// REQ-AUTH-10 / REQ-TAI-001: the local operator record is readable by its own
// identifier (the UI loads theme settings through it) and never exposes a
// password.
func TestREQ_TAI_001_InspectLocalOperator(t *testing.T) {
	t.Parallel()
	h, operator := newOperatorHandler(t)

	rr := serve(h, asOperator(httptest.NewRequest(http.MethodGet, "/users/1", nil), operator))
	require.Equal(t, http.StatusOK, rr.Code)

	var got portainer.User
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	require.Equal(t, operator.ID, got.ID)
	require.Empty(t, got.Password)
}

// REQ-TAI-001: there is no user management, so other user records cannot be
// read or changed through the API.
func TestREQ_TAI_001_OtherUsersAreRefused(t *testing.T) {
	t.Parallel()
	h, operator := newOperatorHandler(t)

	rr := serve(h, asOperator(httptest.NewRequest(http.MethodGet, "/users/2", nil), operator))
	require.Equal(t, http.StatusForbidden, rr.Code)

	rr = serve(h, asOperator(httptest.NewRequest(http.MethodPut, "/users/2", bytes.NewBufferString(`{"Theme":{"color":"dark"}}`)), operator))
	require.Equal(t, http.StatusForbidden, rr.Code)
}

// REQ-AUTH-10: theme preferences still persist without accounts; any role or
// password fields in the payload are ignored.
func TestREQ_AUTH_10_UpdateThemeIgnoresRoleAndPassword(t *testing.T) {
	t.Parallel()
	h, operator := newOperatorHandler(t)

	body := `{"Theme":{"color":"dark"},"Role":2,"Password":"new","Username":"renamed"}`
	rr := serve(h, asOperator(httptest.NewRequest(http.MethodPut, "/users/1", bytes.NewBufferString(body)), operator))
	require.Equal(t, http.StatusOK, rr.Code)

	stored, err := h.DataStore.User().Read(operator.ID)
	require.NoError(t, err)
	require.Equal(t, "dark", stored.ThemeSettings.Color)
	require.Equal(t, portainer.AdministratorRole, stored.Role)
	require.Equal(t, security.LocalOperatorUsername, stored.Username)
	require.Equal(t, "should-never-leak", stored.Password)

	var got portainer.User
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	require.Empty(t, got.Password)
}

// REQ-TAI-001: user management routes that used to live here are not routed.
func TestREQ_TAI_001_UserManagementRoutesAreGone(t *testing.T) {
	t.Parallel()
	h, operator := newOperatorHandler(t)

	for _, tc := range []struct{ method, path string }{
		{http.MethodGet, "/users"},
		{http.MethodPost, "/users"},
		{http.MethodDelete, "/users/2"},
		{http.MethodPut, "/users/1/passwd"},
		{http.MethodGet, "/users/admin/check"},
		{http.MethodPost, "/users/admin/init"},
		{http.MethodGet, "/users/1/tokens"},
		{http.MethodPost, "/users/1/tokens"},
		{http.MethodGet, "/users/1/memberships"},
		{http.MethodGet, "/users/1/effective-access"},
	} {
		rr := serve(h, asOperator(httptest.NewRequest(tc.method, tc.path, nil), operator))
		require.Contains(t, []int{http.StatusNotFound, http.StatusMethodNotAllowed}, rr.Code, "%s %s", tc.method, tc.path)
	}
}
