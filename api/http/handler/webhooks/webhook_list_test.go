package webhooks

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_SWM_09_WebhookList(t *testing.T) {
	t.Parallel()

	t.Run("admin lists all webhooks", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		createWebhookRecord(t, store, "res-a", 1, portainer.ServiceWebhook)
		createWebhookRecord(t, store, "res-b", 2, portainer.ServiceWebhook)

		req := withAdminContext(httptest.NewRequest(http.MethodGet, "/webhooks", nil))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)
		var listed []portainer.Webhook
		require.NoError(t, json.NewDecoder(w.Body).Decode(&listed))
		assert.Len(t, listed, 2)
	})

	t.Run("admin filters by endpoint and resource", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		createWebhookRecord(t, store, "keep-me", 7, portainer.ServiceWebhook)
		createWebhookRecord(t, store, "other-res", 7, portainer.ServiceWebhook)
		createWebhookRecord(t, store, "keep-me", 8, portainer.ServiceWebhook)

		filters := url.QueryEscape(`{"EndpointID":7,"ResourceID":"keep-me"}`)
		req := withAdminContext(httptest.NewRequest(http.MethodGet, "/webhooks?filters="+filters, nil))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)
		var listed []portainer.Webhook
		require.NoError(t, json.NewDecoder(w.Body).Decode(&listed))
		require.Len(t, listed, 1)
		assert.Equal(t, "keep-me", listed[0].ResourceID)
		assert.Equal(t, portainer.EndpointID(7), listed[0].EndpointID)
	})

	t.Run("non-admin gets empty list", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		createWebhookRecord(t, store, "hidden", 1, portainer.ServiceWebhook)

		req := withNonAdminContext(httptest.NewRequest(http.MethodGet, "/webhooks", nil))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)
		var listed []portainer.Webhook
		require.NoError(t, json.NewDecoder(w.Body).Decode(&listed))
		assert.Empty(t, listed)
	})

	t.Run("rejects invalid filters JSON", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := withAdminContext(httptest.NewRequest(http.MethodGet, "/webhooks?filters=not-json", nil))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("missing security context returns internal error", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := httptest.NewRequest(http.MethodGet, "/webhooks", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})
}

func TestFilterWebhooks(t *testing.T) {
	t.Parallel()

	webhooks := []portainer.Webhook{
		{ID: 1, ResourceID: "a", EndpointID: 1},
		{ID: 2, ResourceID: "b", EndpointID: 1},
		{ID: 3, ResourceID: "a", EndpointID: 2},
	}

	t.Run("empty filters return all", func(t *testing.T) {
		t.Parallel()
		got := filterWebhooks(webhooks, &webhookListOperationFilters{})
		assert.Equal(t, webhooks, got)
	})

	t.Run("requires both endpoint and resource match", func(t *testing.T) {
		t.Parallel()
		got := filterWebhooks(webhooks, &webhookListOperationFilters{EndpointID: 1, ResourceID: "a"})
		require.Len(t, got, 1)
		assert.Equal(t, portainer.WebhookID(1), got[0].ID)
	})
}
