package webhooks

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_SWM_09_WebhookDelete(t *testing.T) {
	t.Parallel()

	t.Run("admin deletes webhook", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		webhook := createWebhookRecord(t, store, "svc-del", 1, portainer.ServiceWebhook)

		req := withAdminContext(httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/webhooks/%d", webhook.ID), nil))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusNoContent, w.Code)
		_, err := store.Webhook().Read(webhook.ID)
		assert.True(t, store.IsErrObjectNotFound(err))
	})

	t.Run("rejects non-numeric id", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := withAdminContext(httptest.NewRequest(http.MethodDelete, "/webhooks/not-an-id", nil))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("non-admin is forbidden", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		webhook := createWebhookRecord(t, store, "svc-del-forbid", 1, portainer.ServiceWebhook)

		req := withNonAdminContext(httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/webhooks/%d", webhook.ID), nil))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)
		_, err := store.Webhook().Read(webhook.ID)
		require.NoError(t, err)
	})

	t.Run("missing security context returns internal error", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		webhook := createWebhookRecord(t, store, "svc-del-no-ctx", 1, portainer.ServiceWebhook)

		req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/webhooks/%d", webhook.ID), nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})
}
