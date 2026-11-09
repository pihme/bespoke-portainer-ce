package middlewares

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"
)

// errEndpointService embeds EndpointService and forces Endpoint to return err.
// Used to hit the 500 path of WithEndpoint without a full datastore.
type errEndpointService struct {
	dataservices.EndpointService
	err error
}

func (s errEndpointService) Endpoint(portainer.EndpointID) (*portainer.Endpoint, error) {
	return nil, s.err
}

// denyBouncer wraps the test bouncer but rejects AuthorizedEndpointOperation.
type denyBouncer struct {
	security.BouncerService
}

func (denyBouncer) AuthorizedEndpointOperation(*http.Request, *portainer.Endpoint) error {
	return errors.New("access denied to environment")
}

func localDockerEndpoint(id portainer.EndpointID) *portainer.Endpoint {
	return &portainer.Endpoint{
		ID:   id,
		Name: "local",
		URL:  "unix:///var/run/docker.sock",
		Type: portainer.DockerEnvironment,
	}
}

func requestWithEndpoint(r *http.Request, endpoint *portainer.Endpoint) *http.Request {
	ctx := context.WithValue(r.Context(), contextEndpoint, endpoint)
	return r.WithContext(ctx)
}

func TestWithEndpoint_DefaultsParamAndLoadsEndpoint(t *testing.T) {
	t.Parallel()

	ep := localDockerEndpoint(7)
	ds := testhelpers.NewDatastore(testhelpers.WithEndpoints([]portainer.Endpoint{*ep}))

	var got *portainer.Endpoint
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var err error
		got, err = FetchEndpoint(r)
		require.NoError(t, err)
		w.WriteHeader(http.StatusOK)
	})

	// Empty param name must default to "id".
	handler := WithEndpoint(ds.Endpoint(), "")(next)

	req := httptest.NewRequest(http.MethodGet, "/endpoints/7", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "7"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.NotNil(t, got)
	require.Equal(t, portainer.EndpointID(7), got.ID)
	require.Equal(t, "local", got.Name)
}

func TestWithEndpoint_CustomParamName(t *testing.T) {
	t.Parallel()

	ep := localDockerEndpoint(3)
	ds := testhelpers.NewDatastore(testhelpers.WithEndpoints([]portainer.Endpoint{*ep}))

	var gotID portainer.EndpointID
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		endpoint, err := FetchEndpoint(r)
		require.NoError(t, err)
		gotID = endpoint.ID
		w.WriteHeader(http.StatusOK)
	})

	handler := WithEndpoint(ds.Endpoint(), "endpointId")(next)

	req := httptest.NewRequest(http.MethodGet, "/environments/3/docker", nil)
	req = mux.SetURLVars(req, map[string]string{"endpointId": "3"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, portainer.EndpointID(3), gotID)
}

func TestWithEndpoint_InvalidRouteVariable(t *testing.T) {
	t.Parallel()

	ds := testhelpers.NewDatastore(testhelpers.WithEndpoints(nil))
	called := false
	next := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		called = true
	})

	handler := WithEndpoint(ds.Endpoint(), "id")(next)

	req := httptest.NewRequest(http.MethodGet, "/endpoints/abc", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "abc"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.False(t, called)
}

func TestWithEndpoint_MissingRouteVariable(t *testing.T) {
	t.Parallel()

	ds := testhelpers.NewDatastore(testhelpers.WithEndpoints(nil))
	handler := WithEndpoint(ds.Endpoint(), "id")(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("next must not run")
	}))

	req := httptest.NewRequest(http.MethodGet, "/endpoints/", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestWithEndpoint_NotFound(t *testing.T) {
	t.Parallel()

	ds := testhelpers.NewDatastore(testhelpers.WithEndpoints(nil))
	handler := WithEndpoint(ds.Endpoint(), "id")(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("next must not run")
	}))

	req := httptest.NewRequest(http.MethodGet, "/endpoints/99", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "99"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestWithEndpoint_LookupError(t *testing.T) {
	t.Parallel()

	svc := errEndpointService{err: errors.New("bolt read failed")}
	handler := WithEndpoint(svc, "id")(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("next must not run")
	}))

	req := httptest.NewRequest(http.MethodGet, "/endpoints/1", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusInternalServerError, rec.Code)
}

func TestFetchEndpoint_MissingFromContext(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	endpoint, err := FetchEndpoint(req)

	require.Nil(t, endpoint)
	require.Error(t, err)
	require.Contains(t, err.Error(), "Unable to find environment data in request context")
}

func TestCheckEndpointAuthorization_MissingEndpoint(t *testing.T) {
	t.Parallel()

	bouncer := testhelpers.NewTestRequestBouncer()
	called := false
	handler := CheckEndpointAuthorization(bouncer)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		called = true
	}))

	req := httptest.NewRequest(http.MethodGet, "/endpoints/1", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNotFound, rec.Code)
	require.False(t, called)
}

func TestCheckEndpointAuthorization_Denied(t *testing.T) {
	t.Parallel()

	ep := localDockerEndpoint(1)
	bouncer := denyBouncer{BouncerService: testhelpers.NewTestRequestBouncer()}

	called := false
	handler := CheckEndpointAuthorization(bouncer)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		called = true
		t.Fatal("next must not run when authorization fails")
	}))

	req := requestWithEndpoint(httptest.NewRequest(http.MethodGet, "/endpoints/1", nil), ep)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusForbidden, rec.Code)
	require.False(t, called)
}

func TestCheckEndpointAuthorization_Allowed(t *testing.T) {
	t.Parallel()

	ep := localDockerEndpoint(2)
	ds := testhelpers.NewDatastore(testhelpers.WithEndpoints([]portainer.Endpoint{*ep}))
	bouncer := testhelpers.NewTestRequestBouncer()

	called := false
	handler := WithEndpoint(ds.Endpoint(), "id")(
		CheckEndpointAuthorization(bouncer)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			called = true
			endpoint, err := FetchEndpoint(r)
			require.NoError(t, err)
			require.Equal(t, portainer.EndpointID(2), endpoint.ID)
			w.WriteHeader(http.StatusNoContent)
		})),
	)

	req := httptest.NewRequest(http.MethodGet, "/endpoints/2", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "2"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)
	require.True(t, called)
}
