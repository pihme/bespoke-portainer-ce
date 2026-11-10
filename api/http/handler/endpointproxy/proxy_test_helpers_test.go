package endpointproxy

import (
	"errors"
	"net/http"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/proxy"
	"github.com/portainer/portainer/api/http/security"
)

// denyBouncer wraps the test bouncer but rejects AuthorizedEndpointOperation.
// Used to test the 403 path without setting up a full JWT stack.
type denyBouncer struct {
	security.BouncerService
}

func (denyBouncer) AuthorizedEndpointOperation(_ *http.Request, _ *portainer.Endpoint) error {
	return errors.New("access denied to environment")
}

// setupProxyHandler builds a Handler backed by a real (empty) test datastore.
// The real datastore is required because the proxy handlers use ViewTx,
// which must execute its callback to populate the endpoint variable.
func setupProxyHandler(t *testing.T, bouncer security.BouncerService) (*Handler, *datastore.Store) {
	t.Helper()

	_, store := datastore.MustNewTestStore(t, false, false)

	h := NewHandler(bouncer)
	h.DataStore = store
	h.ProxyManager = proxy.NewManager()

	return h, store
}

// Verify denyBouncer satisfies the interface at compile time.
var _ security.BouncerService = denyBouncer{}
