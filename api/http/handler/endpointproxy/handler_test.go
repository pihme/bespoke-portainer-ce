package endpointproxy

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/portainer/portainer/api/http/security"

	"github.com/stretchr/testify/assert"
)

// routeTaggingBouncer answers every request with the name of the access policy
// guarding the route, without reaching the proxy handler behind it.
type routeTaggingBouncer struct {
	security.BouncerService
}

func tagWith(tag string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(tag))
	})
}

func (routeTaggingBouncer) AuthenticatedAccess(http.Handler) http.Handler {
	return tagWith("session")
}

func TestProxyRoutes_AreSessionGuarded(t *testing.T) {
	t.Parallel()

	h := NewHandler(routeTaggingBouncer{})

	for _, path := range []string{
		"/1/docker/containers/json",
	} {
		t.Run(path, func(t *testing.T) {
			rw := httptest.NewRecorder()

			h.ServeHTTP(rw, httptest.NewRequest(http.MethodGet, path, nil))

			assert.Equal(t, "session", rw.Body.String())
		})
	}
}

// REQ-TAI-002: the Kubernetes API proxy (direct and through the Agent) is
// removed with Kubernetes.
func TestREQ_TAI_002_KubernetesProxyRoutesAreGone(t *testing.T) {
	t.Parallel()

	h := NewHandler(routeTaggingBouncer{})

	for _, path := range []string{
		"/1/kubernetes/api/v1/namespaces",
		"/1/agent/kubernetes/v2/browse",
	} {
		t.Run(path, func(t *testing.T) {
			rw := httptest.NewRecorder()

			h.ServeHTTP(rw, httptest.NewRequest(http.MethodGet, path, nil))

			assert.Equal(t, http.StatusNotFound, rw.Code)
		})
	}
}

// REQ-TAI-007: the Portainer Agent proxy routes (Docker through the Agent and
// the Agent host API) are removed with Agent environments.
func TestREQ_TAI_007_AgentProxyRoutesAreGone(t *testing.T) {
	t.Parallel()

	h := NewHandler(routeTaggingBouncer{})

	for _, path := range []string{
		"/1/agent/docker/containers/json",
		"/1/agent/host/docker-storage",
	} {
		t.Run(path, func(t *testing.T) {
			rw := httptest.NewRecorder()

			h.ServeHTTP(rw, httptest.NewRequest(http.MethodGet, path, nil))

			assert.Equal(t, http.StatusNotFound, rw.Code)
		})
	}
}

// REQ-TAI-008: the Azure API proxy is removed with Azure Container Instances.
func TestREQ_TAI_008_AzureProxyRouteIsGone(t *testing.T) {
	t.Parallel()

	h := NewHandler(routeTaggingBouncer{})

	rw := httptest.NewRecorder()
	h.ServeHTTP(rw, httptest.NewRequest(http.MethodGet, "/1/azure/subscriptions", nil))

	assert.Equal(t, http.StatusNotFound, rw.Code)
}
