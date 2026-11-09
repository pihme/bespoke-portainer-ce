package webhooks

import (
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	dockerclient "github.com/portainer/portainer/api/docker/client"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_SWM_09_WebhookExecute(t *testing.T) {
	t.Parallel()

	t.Run("unknown token returns not found", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)

		req := httptest.NewRequest(http.MethodPost, "/webhooks/missing-token-uuid", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("missing endpoint returns not found", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		webhook := &portainer.Webhook{
			Token:       "tok-missing-endpoint",
			ResourceID:  "svc-x",
			EndpointID:  42,
			WebhookType: portainer.ServiceWebhook,
		}
		require.NoError(t, store.Webhook().Create(webhook))

		req := httptest.NewRequest(http.MethodPost, "/webhooks/"+webhook.Token, nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})

	t.Run("unsupported webhook type returns internal error", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		createLocalDockerEndpoint(t, store, 5)
		webhook := &portainer.Webhook{
			Token:       "tok-unsupported-type",
			ResourceID:  "res-unsupported",
			EndpointID:  5,
			WebhookType: 99,
		}
		require.NoError(t, store.Webhook().Create(webhook))

		req := httptest.NewRequest(http.MethodPost, "/webhooks/"+webhook.Token, nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})

	t.Run("service webhook against unreachable local docker returns error", func(t *testing.T) {
		t.Parallel()
		_, store := datastore.MustNewTestStore(t, true, false)
		handler := setUpHandler(t, store)
		handler.DockerClientFactory = dockerclient.NewClientFactory(nil, nil)

		endpoint := &portainer.Endpoint{
			ID:   6,
			Name: "local-docker-unreachable",
			Type: portainer.DockerEnvironment,
			URL:  "tcp://127.0.0.1:1",
		}
		require.NoError(t, store.Endpoint().Create(endpoint))

		webhook := &portainer.Webhook{
			Token:       "tok-service-unreachable",
			ResourceID:  "svc-local",
			EndpointID:  6,
			WebhookType: portainer.ServiceWebhook,
		}
		require.NoError(t, store.Webhook().Create(webhook))

		req := httptest.NewRequest(http.MethodPost, "/webhooks/"+webhook.Token+"?tag=latest", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		// CreateClient succeeds; ServiceInspect against the closed port fails.
		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})
}
