package containers

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	dockerdomain "github.com/portainer/portainer/api/docker"
	dockerclient "github.com/portainer/portainer/api/docker/client"
	"github.com/portainer/portainer/api/http/middlewares"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// denyBouncer rejects AuthorizedEndpointOperation so recreate's second auth check returns 403.
type denyBouncer struct {
	security.BouncerService
}

func (denyBouncer) AuthorizedEndpointOperation(_ *http.Request, _ *portainer.Endpoint) error {
	return errors.New("access denied to environment")
}

func newHandlerUnderTest(
	t *testing.T,
	bouncer security.BouncerService,
	endpointURL string,
	endpointType portainer.EndpointType,
) (*mux.Router, *Handler, *datastore.Store, *portainer.Endpoint) {
	t.Helper()

	if bouncer == nil {
		bouncer = testhelpers.NewTestRequestBouncer()
	}
	if endpointType == 0 {
		endpointType = portainer.DockerEnvironment
	}
	if endpointURL == "" {
		endpointURL = "tcp://127.0.0.1:1"
	}

	_, store := datastore.MustNewTestStore(t, true, true)

	endpoint := &portainer.Endpoint{
		ID:   1,
		Name: "local-docker",
		Type: endpointType,
		URL:  endpointURL,
	}
	require.NoError(t, store.Endpoint().Create(endpoint))

	factory := dockerclient.NewClientFactory(nil, nil)
	containerService := dockerdomain.NewContainerService(factory, store)
	h := NewHandler("/docker/{id}/containers", bouncer, store, factory, containerService)

	root := mux.NewRouter()
	sub := root.PathPrefix("/docker/{id}").Subrouter()
	sub.Use(middlewares.WithEndpoint(store.Endpoint(), "id"))
	sub.PathPrefix("/containers").Handler(h)

	return root, h, store, endpoint
}

func TestNewHandler_RegistersGPUAndRecreateRoutes(t *testing.T) {
	t.Parallel()

	_, h, _, _ := newHandlerUnderTest(t, nil, "", 0)
	require.NotNil(t, h)
	require.NotNil(t, h.Router)
	require.NotNil(t, h.bouncer)
	require.NotNil(t, h.dataStore)
	require.NotNil(t, h.dockerClientFactory)
	require.NotNil(t, h.containerService)

	for _, tc := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/docker/1/containers/ctr-1/gpus"},
		{http.MethodPost, "/docker/1/containers/ctr-1/recreate"},
	} {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		var match mux.RouteMatch
		ok := h.Match(req, &match)
		assert.Truef(t, ok, "expected containers handler route for %s %s", tc.method, tc.path)
	}
}
