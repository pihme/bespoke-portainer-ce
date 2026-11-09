package webhooks

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/require"
)

func setUpHandler(t *testing.T, store *datastore.Store) *Handler {
	t.Helper()
	handler := NewHandler(testhelpers.NewTestRequestBouncer())
	handler.DataStore = store
	return handler
}

func withAdminContext(r *http.Request) *http.Request {
	return r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{
		UserID:  1,
		IsAdmin: true,
		User:    &portainer.User{ID: 1, Role: portainer.AdministratorRole},
	}))
}

func withNonAdminContext(r *http.Request) *http.Request {
	return r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{
		UserID:  2,
		IsAdmin: false,
		User:    &portainer.User{ID: 2, Role: portainer.StandardUserRole},
	}))
}

func jsonRequest(t *testing.T, method, path string, payload any) *http.Request {
	t.Helper()
	var body *bytes.Reader
	if payload == nil {
		body = bytes.NewReader(nil)
	} else if raw, ok := payload.([]byte); ok {
		body = bytes.NewReader(raw)
	} else {
		b, err := json.Marshal(payload)
		require.NoError(t, err)
		body = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, path, body)
	req.Header.Set("Content-Type", "application/json")
	return req
}

func createWebhookRecord(t *testing.T, store *datastore.Store, resourceID string, endpointID portainer.EndpointID, webhookType portainer.WebhookType) *portainer.Webhook {
	t.Helper()
	webhook := &portainer.Webhook{
		Token:       "token-" + resourceID,
		ResourceID:  resourceID,
		EndpointID:  endpointID,
		WebhookType: webhookType,
	}
	require.NoError(t, store.Webhook().Create(webhook))
	return webhook
}

func createLocalDockerEndpoint(t *testing.T, store *datastore.Store, id portainer.EndpointID) *portainer.Endpoint {
	t.Helper()
	endpoint := &portainer.Endpoint{
		ID:   id,
		Name: "local-docker",
		Type: portainer.DockerEnvironment,
		URL:  "unix:///var/run/docker.sock",
	}
	require.NoError(t, store.Endpoint().Create(endpoint))
	return endpoint
}

func TestNewHandler_RegistersWebhookRoutes(t *testing.T) {
	t.Parallel()
	handler := NewHandler(testhelpers.NewTestRequestBouncer())
	require.NotNil(t, handler)
	require.NotNil(t, handler.Router)
}
