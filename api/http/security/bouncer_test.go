package security

import (
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

// testHandler200 is a simple handler which returns HTTP status 200 OK
var testHandler200 = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

func TestCSPHeaderDefault(t *testing.T) {
	t.Parallel()
	b := NewRequestBouncer(t.Context(), nil)

	srv := httptest.NewServer(
		b.PublicAccess(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})),
	)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/")
	require.NoError(t, err)
	defer func() {
		err := resp.Body.Close()
		require.NoError(t, err)
	}()

	require.Contains(t, resp.Header, "Content-Security-Policy")
}

func TestCSPHeaderDisabled(t *testing.T) {
	t.Parallel()
	b := NewRequestBouncer(t.Context(), nil)
	b.DisableCSP()

	srv := httptest.NewServer(
		b.PublicAccess(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})),
	)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/")
	require.NoError(t, err)
	defer func() {
		err := resp.Body.Close()
		require.NoError(t, err)
	}()

	require.NotContains(t, resp.Header, "Content-Security-Policy")
}

func TestMWSecureHeaders_SetsHSTSWhenEnabled(t *testing.T) {
	t.Parallel()

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)

	called := false
	handler := MWSecureHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}), true, false)

	handler.ServeHTTP(rr, req)

	require.True(t, called)
	require.Equal(t, "max-age=31536000", rr.Header().Get("Strict-Transport-Security"))
	require.Empty(t, rr.Header().Get("Content-Security-Policy"))
	require.Equal(t, "nosniff", rr.Header().Get("X-Content-Type-Options"))
}

// TAI-001: every access level serves the request as the local operator, with
// or without credentials; tokens and API keys are ignored, nothing answers 401.
func TestREQ_TAI_001_AccessLevelsServeTheLocalOperatorWithoutLogin(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, true)
	require.NoError(t, store.User().Create(&portainer.User{ID: 1, Username: LocalOperatorUsername, Role: portainer.AdministratorRole}))

	bouncer := NewRequestBouncer(t.Context(), store)

	guards := map[string]func(http.Handler) http.Handler{
		"admin":         bouncer.AdminAccess,
		"restricted":    bouncer.RestrictedAccess,
		"authenticated": bouncer.AuthenticatedAccess,
		"kubeconfig":    bouncer.AuthenticatedAccessAllowingKubeconfig,
	}

	headers := map[string]map[string]string{
		"no credentials": {},
		"bearer token":   {"Authorization": "Bearer not-a-jwt"},
		"api key":        {"X-API-Key": "not-a-key"},
		"both":           {"Authorization": "Bearer not-a-jwt", "X-API-Key": "not-a-key"},
	}

	for guardName, guard := range guards {
		for headerName, hs := range headers {
			t.Run(guardName+"/"+headerName, func(t *testing.T) {
				var ctx *RestrictedRequestContext
				var token *portainer.TokenData

				h := guard(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					var err error
					ctx, err = RetrieveRestrictedRequestContext(r)
					require.NoError(t, err)
					token, err = RetrieveTokenData(r)
					require.NoError(t, err)
				}))

				r := httptest.NewRequest(http.MethodGet, "/", nil)
				for k, v := range hs {
					r.Header.Set(k, v)
				}

				rr := httptest.NewRecorder()
				h.ServeHTTP(rr, r)

				require.Equal(t, http.StatusOK, rr.Code)
				require.NotNil(t, ctx)
				require.True(t, ctx.IsAdmin)
				require.Equal(t, portainer.UserID(1), ctx.UserID)
				require.Equal(t, portainer.AdministratorRole, token.Role)
				require.Equal(t, "nosniff", rr.Header().Get("X-Content-Type-Options"))
			})
		}
	}
}

func TestREQ_TAI_001_LocalOperatorWithoutStoredRecord(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, true)

	user, err := LocalOperator(store)
	require.NoError(t, err)
	require.Equal(t, portainer.UserID(1), user.ID)
	require.Equal(t, portainer.AdministratorRole, user.Role)

	created, err := EnsureLocalOperator(store)
	require.NoError(t, err)
	require.True(t, created)

	created, err = EnsureLocalOperator(store)
	require.NoError(t, err)
	require.False(t, created)

	admins, err := store.User().UsersByRole(portainer.AdministratorRole)
	require.NoError(t, err)
	require.Len(t, admins, 1)
	require.Equal(t, LocalOperatorUsername, admins[0].Username)
	require.Empty(t, admins[0].Password)
}

func TestREQ_TAI_001_LocalOperatorIsLowestAdministrator(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, true)
	// The store assigns increasing identifiers in creation order.
	require.NoError(t, store.User().Create(&portainer.User{Username: "standard", Role: portainer.StandardUserRole}))
	require.NoError(t, store.User().Create(&portainer.User{Username: "older", Role: portainer.AdministratorRole, Password: "hash"}))
	require.NoError(t, store.User().Create(&portainer.User{Username: "newer", Role: portainer.AdministratorRole, Password: "hash"}))

	user, err := LocalOperator(store)
	require.NoError(t, err)
	require.Equal(t, "older", user.Username)
	require.Empty(t, user.Password)
}

func TestREQ_TAI_001_AuthorizedEndpointOperationNeedsNoToken(t *testing.T) {
	t.Parallel()

	bouncer := NewRequestBouncer(t.Context(), nil)
	req := httptest.NewRequest(http.MethodGet, "/", nil)

	require.NoError(t, bouncer.AuthorizedEndpointOperation(req, &portainer.Endpoint{ID: 1}))
}
