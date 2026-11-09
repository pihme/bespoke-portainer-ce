package registries

import (
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"

	"github.com/stretchr/testify/require"
)

func newTestHandler(t *testing.T) (*Handler, dataservices.DataStore) {
	t.Helper()

	_, store := datastore.MustNewTestStore(t, false, false)
	require.NotNil(t, store)

	handler := NewHandler(testhelpers.NewTestRequestBouncer())
	handler.DataStore = store

	return handler, store
}

func TestHandler_registryDelete(t *testing.T) {
	t.Parallel()

	handler, store := newTestHandler(t)

	registry := &portainer.Registry{Type: portainer.ProGetRegistry, Name: "test-registry"}
	err := store.Registry().Create(registry)
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodDelete, "/registries/1", nil)

	restrictedContext := &security.RestrictedRequestContext{IsAdmin: true, UserID: 1}

	ctx := security.StoreRestrictedRequestContext(r, restrictedContext)
	r = r.WithContext(ctx)

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	require.Equal(t, http.StatusNoContent, w.Code)

	_, err = store.Registry().Read(registry.ID)
	require.Error(t, err)
}

func TestHandler_registryDelete_NotFound(t *testing.T) {
	t.Parallel()

	handler, _ := newTestHandler(t)

	r := httptest.NewRequest(http.MethodDelete, "/registries/1", nil)

	restrictedContext := &security.RestrictedRequestContext{IsAdmin: true, UserID: 1}

	ctx := security.StoreRestrictedRequestContext(r, restrictedContext)
	r = r.WithContext(ctx)

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	require.Equal(t, http.StatusInternalServerError, w.Code)
}

// --- cleanupRegistryFromNamespaces unit tests ---

// --- deleteKubernetesSecrets integration tests ---
