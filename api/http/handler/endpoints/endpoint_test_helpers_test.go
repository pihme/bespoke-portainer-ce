package endpoints

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/proxy"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/api/pendingactions"
	"github.com/stretchr/testify/require"
)

func newDockerEndpointHandler(t *testing.T) (*Handler, *datastore.Store) {
	t.Helper()
	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.User().Create(&portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}))

	h := NewHandler(testhelpers.NewTestRequestBouncer())
	h.DataStore = store
	h.ComposeStackManager = testhelpers.NewComposeStackManager()
	h.SnapshotService = fakeSnapshotService{}
	h.PendingActionsService = pendingactions.NewService(store, nil)
	h.ProxyManager = proxy.NewManager(nil)
	h.ProxyManager.NewProxyFactory(nil, nil, nil, nil, nil, nil, nil, nil, nil)
	return h, store
}

func createDockerEndpoint(t *testing.T, store *datastore.Store, id portainer.EndpointID, name string) *portainer.Endpoint {
	t.Helper()
	ep := &portainer.Endpoint{
		ID:      id,
		Name:    name,
		Type:    portainer.DockerEnvironment,
		URL:     "unix:///var/run/docker.sock",
		GroupID: 1,
		Status:  portainer.EndpointStatusUp,
		SecuritySettings: portainer.EndpointSecuritySettings{
			AllowStackManagementForRegularUsers: true,
		},
	}
	require.NoError(t, store.Endpoint().Create(ep))
	return ep
}

func endpointAdminRequest(method, target string, body []byte) *http.Request {
	var r *http.Request
	if body != nil {
		r = httptest.NewRequest(method, target, bytes.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
	} else {
		r = httptest.NewRequest(method, target, nil)
	}
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{
		IsAdmin: true,
		UserID:  1,
		User:    &portainer.User{ID: 1, Role: portainer.AdministratorRole},
	}))
	r = r.WithContext(security.StoreTokenData(r, &portainer.TokenData{
		ID: 1, Username: "admin", Role: portainer.AdministratorRole,
	}))
	testhelpers.AddTestSecurityCookie(r, "Bearer dummytoken")
	return r
}
