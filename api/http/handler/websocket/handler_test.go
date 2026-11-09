package websocket

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewHandler_RegistersConsoleAndPodRoutes(t *testing.T) {
	t.Parallel()

	h := NewHandler(nil, testhelpers.NewTestRequestBouncer())
	require.NotNil(t, h)
	require.NotNil(t, h.Router)
	assert.NotNil(t, h.requestBouncer)
	assert.NotNil(t, h.connectionUpgrader)

	for _, path := range []string{
		"/websocket/exec",
		"/websocket/attach",
		"/websocket/pod",
		"/websocket/kubernetes-shell",
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		var match mux.RouteMatch
		ok := h.Match(req, &match)
		assert.Truef(t, ok, "expected route for %s", path)
	}
}
