package webhooks

import (
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_SWM_09_WebhookCreatePayload_Validate(t *testing.T) {
	t.Parallel()

	t.Run("accepts service webhook for local docker endpoint", func(t *testing.T) {
		t.Parallel()
		payload := &webhookCreatePayload{
			ResourceID:  "svc-local-1",
			EndpointID:  1,
			WebhookType: portainer.ServiceWebhook,
		}
		require.NoError(t, payload.Validate(nil))
	})

	t.Run("rejects empty ResourceID", func(t *testing.T) {
		t.Parallel()
		payload := &webhookCreatePayload{
			EndpointID:  1,
			WebhookType: portainer.ServiceWebhook,
		}
		require.EqualError(t, payload.Validate(nil), "Invalid ResourceID")
	})

	t.Run("rejects zero EndpointID", func(t *testing.T) {
		t.Parallel()
		payload := &webhookCreatePayload{
			ResourceID:  "svc-local-1",
			WebhookType: portainer.ServiceWebhook,
		}
		require.EqualError(t, payload.Validate(nil), "Invalid EndpointID")
	})

	t.Run("rejects non-service webhook type", func(t *testing.T) {
		t.Parallel()
		payload := &webhookCreatePayload{
			ResourceID:  "svc-local-1",
			EndpointID:  1,
			WebhookType: 99,
		}
		require.EqualError(t, payload.Validate(nil), "Invalid WebhookType")
	})
}

func TestREQ_SWM_09_WebhookCreate(t *testing.T) {
	t.Parallel()

	t.Run("admin creates webhook for local docker resource", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		createLocalDockerEndpoint(t, store, 1)

		req := withAdminContext(jsonRequest(t, http.MethodPost, "/webhooks", webhookCreatePayload{
			ResourceID:  "local-svc-abc",
			EndpointID:  1,
			WebhookType: portainer.ServiceWebhook,
		}))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		var created portainer.Webhook
		require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
		assert.Equal(t, "local-svc-abc", created.ResourceID)
		assert.Equal(t, portainer.EndpointID(1), created.EndpointID)
		assert.Equal(t, portainer.ServiceWebhook, created.WebhookType)
		assert.NotEmpty(t, created.Token)
		assert.NotZero(t, created.ID)
		assert.Zero(t, created.RegistryID)

		saved, err := store.Webhook().Read(created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.Token, saved.Token)
		assert.Equal(t, "local-svc-abc", saved.ResourceID)
	})

	t.Run("rejects duplicate resource webhook", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		createWebhookRecord(t, store, "dup-resource", 1, portainer.ServiceWebhook)

		req := withAdminContext(jsonRequest(t, http.MethodPost, "/webhooks", webhookCreatePayload{
			ResourceID:  "dup-resource",
			EndpointID:  1,
			WebhookType: portainer.ServiceWebhook,
		}))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusConflict, w.Code)
	})

	t.Run("non-admin is forbidden", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := withNonAdminContext(jsonRequest(t, http.MethodPost, "/webhooks", webhookCreatePayload{
			ResourceID:  "local-svc-forbid",
			EndpointID:  1,
			WebhookType: portainer.ServiceWebhook,
		}))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("rejects invalid JSON payload", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := withAdminContext(jsonRequest(t, http.MethodPost, "/webhooks", []byte(`{`)))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("rejects invalid webhook type via HTTP", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := withAdminContext(jsonRequest(t, http.MethodPost, "/webhooks", map[string]any{
			"ResourceID":  "x",
			"EndpointID":  1,
			"WebhookType": 0,
		}))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("missing security context returns internal error", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := jsonRequest(t, http.MethodPost, "/webhooks", webhookCreatePayload{
			ResourceID:  "no-ctx",
			EndpointID:  1,
			WebhookType: portainer.ServiceWebhook,
		})
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})
}
