package webhook_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/webhook"
	"github.com/portainer/portainer/api/datastore"
	"github.com/stretchr/testify/require"
)

func TestNewServiceAndCreateLookup(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	svc, err := webhook.NewService(store.Connection())
	require.NoError(t, err)
	require.Equal(t, webhook.BucketName, svc.BucketName())

	wh := &portainer.Webhook{
		Token:       "tok-local-1",
		ResourceID:  "image@sha256:abc",
		EndpointID:  1,
		WebhookType: portainer.ServiceWebhook,
	}

	require.NoError(t, store.Webhook().Create(wh))
	require.NotZero(t, wh.ID)

	byResource, err := store.Webhook().WebhookByResourceID("image@sha256:abc")
	require.NoError(t, err)
	require.Equal(t, wh.ID, byResource.ID)
	require.Equal(t, "tok-local-1", byResource.Token)

	byToken, err := store.Webhook().WebhookByToken("tok-local-1")
	require.NoError(t, err)
	require.Equal(t, wh.ID, byToken.ID)

	_, err = store.Webhook().WebhookByResourceID("missing")
	require.Error(t, err)
	require.True(t, dataservices.IsErrObjectNotFound(err))

	_, err = store.Webhook().WebhookByToken("missing-token")
	require.Error(t, err)
	require.True(t, dataservices.IsErrObjectNotFound(err))
}

func TestWebhookReadUpdateDelete(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	wh := &portainer.Webhook{
		Token:      "tok-2",
		ResourceID: "ctr-1",
		EndpointID: 2,
	}
	require.NoError(t, store.Webhook().Create(wh))

	got, err := store.Webhook().Read(wh.ID)
	require.NoError(t, err)
	got.Token = "tok-2-updated"
	require.NoError(t, store.Webhook().Update(wh.ID, got))

	updated, err := store.Webhook().WebhookByToken("tok-2-updated")
	require.NoError(t, err)
	require.Equal(t, wh.ID, updated.ID)

	require.NoError(t, store.Webhook().Delete(wh.ID))
	_, err = store.Webhook().Read(wh.ID)
	require.Error(t, err)
	require.True(t, dataservices.IsErrObjectNotFound(err))
}
