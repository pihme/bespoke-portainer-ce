package utils

import (
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	dockerclient "github.com/portainer/portainer/api/docker/client"
	"github.com/portainer/portainer/api/http/middlewares"
	"github.com/portainer/portainer/api/internal/testhelpers"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"
	pkgtesthelpers "github.com/portainer/portainer/pkg/testhelpers"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"
)

func TestGetClient_MissingEndpoint(t *testing.T) {
	t.Parallel()
	factory := dockerclient.NewClientFactory(pkgtesthelpers.NewStubSignatureService())
	req := httptest.NewRequest(http.MethodGet, "/docker", nil)
	cli, herr := GetClient(req, factory)
	require.Nil(t, cli)
	require.NotNil(t, herr)
	require.Equal(t, http.StatusNotFound, herr.StatusCode)
}

func TestGetClient_CreateClientError(t *testing.T) {
	t.Parallel()
	// Azure is rejected by CreateClient and exercises the factory error arm.
	ep := &portainer.Endpoint{
		ID:   1,
		Type: portainer.AzureEnvironment,
		URL:  "https://azure.example",
	}
	ds := testhelpers.NewDatastore(testhelpers.WithEndpoints([]portainer.Endpoint{*ep}))
	factory := dockerclient.NewClientFactory(pkgtesthelpers.NewStubSignatureService())

	var (
		cli  any
		herr *httperror.HandlerError
	)
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, h := GetClient(r, factory)
		cli = c
		herr = h
	})
	handler := middlewares.WithEndpoint(ds.Endpoint(), "id")(next)

	req := httptest.NewRequest(http.MethodGet, "/endpoints/1/docker", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	require.Nil(t, cli)
	require.NotNil(t, herr)
	require.Equal(t, http.StatusInternalServerError, herr.StatusCode)
}

func TestGetClient_LocalDockerSuccess(t *testing.T) {
	t.Parallel()
	ep := &portainer.Endpoint{
		ID:   1,
		Type: portainer.DockerEnvironment,
		URL:  "unix:///var/run/docker.sock",
	}
	ds := testhelpers.NewDatastore(testhelpers.WithEndpoints([]portainer.Endpoint{*ep}))
	factory := dockerclient.NewClientFactory(pkgtesthelpers.NewStubSignatureService())

	var (
		cli  any
		herr *httperror.HandlerError
	)
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, h := GetClient(r, factory)
		cli = c
		herr = h
	})
	handler := middlewares.WithEndpoint(ds.Endpoint(), "id")(next)

	req := httptest.NewRequest(http.MethodGet, "/endpoints/1/docker", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	handler.ServeHTTP(httptest.NewRecorder(), req)

	require.Nil(t, herr)
	require.NotNil(t, cli)
}
