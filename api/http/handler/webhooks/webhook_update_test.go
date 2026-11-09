package webhooks

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_SWM_09_WebhookUpdatePayload_Validate(t *testing.T) {
	t.Parallel()
	payload := &webhookUpdatePayload{RegistryID: 0}
	require.NoError(t, payload.Validate(nil))
}

func TestREQ_SWM_09_WebhookUpdate(t *testing.T) {
	t.Parallel()

	t.Run("admin clears registry on local docker webhook", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		webhook := &portainer.Webhook{
			Token:       "tok-update",
			ResourceID:  "svc-update",
			EndpointID:  3,
			RegistryID:  9,
			WebhookType: portainer.ServiceWebhook,
		}
		require.NoError(t, store.Webhook().Create(webhook))

		req := withAdminContext(jsonRequest(t, http.MethodPut, fmt.Sprintf("/webhooks/%d", webhook.ID), webhookUpdatePayload{
			RegistryID: 0,
		}))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)
		var updated portainer.Webhook
		require.NoError(t, json.NewDecoder(w.Body).Decode(&updated))
		assert.Zero(t, updated.RegistryID)
		assert.Equal(t, webhook.ResourceID, updated.ResourceID)

		saved, err := store.Webhook().Read(webhook.ID)
		require.NoError(t, err)
		assert.Zero(t, saved.RegistryID)
	})

	t.Run("not found for unknown id", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := withAdminContext(jsonRequest(t, http.MethodPut, "/webhooks/999", webhookUpdatePayload{}))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("rejects non-numeric id", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := withAdminContext(jsonRequest(t, http.MethodPut, "/webhooks/not-an-id", webhookUpdatePayload{}))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("non-admin is forbidden", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		webhook := createWebhookRecord(t, store, "svc-forbid-upd", 1, portainer.ServiceWebhook)

		req := withNonAdminContext(jsonRequest(t, http.MethodPut, fmt.Sprintf("/webhooks/%d", webhook.ID), webhookUpdatePayload{}))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("rejects invalid JSON payload", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		webhook := createWebhookRecord(t, store, "svc-bad-json", 1, portainer.ServiceWebhook)

		req := withAdminContext(jsonRequest(t, http.MethodPut, fmt.Sprintf("/webhooks/%d", webhook.ID), []byte(`{`)))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("missing security context returns internal error", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		webhook := createWebhookRecord(t, store, "svc-no-ctx-upd", 1, portainer.ServiceWebhook)

		req := jsonRequest(t, http.MethodPut, fmt.Sprintf("/webhooks/%d", webhook.ID), webhookUpdatePayload{})
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})
}
