package ssl_test

import (
	"testing"

	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/ssl"
	"github.com/portainer/portainer/api/datastore"
	"github.com/stretchr/testify/require"
)

func TestSSLSettingsReadUpdateAndTx(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	svc, err := ssl.NewService(store.Connection())
	require.NoError(t, err)
	require.Equal(t, ssl.BucketName, svc.BucketName())

	got, err := store.SSLSettings().Settings()
	require.NoError(t, err)
	require.NotNil(t, got)

	got.HTTPEnabled = true
	got.CertPath = "/tmp/cert.pem"
	got.KeyPath = "/tmp/key.pem"
	require.NoError(t, store.SSLSettings().UpdateSettings(got))

	updated, err := store.SSLSettings().Settings()
	require.NoError(t, err)
	require.True(t, updated.HTTPEnabled)
	require.Equal(t, "/tmp/cert.pem", updated.CertPath)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		s, err := tx.SSLSettings().Settings()
		if err != nil {
			return err
		}
		require.True(t, s.HTTPEnabled)
		require.Equal(t, ssl.BucketName, tx.SSLSettings().BucketName())
		s.HTTPEnabled = false
		return tx.SSLSettings().UpdateSettings(s)
	}))

	final, err := store.SSLSettings().Settings()
	require.NoError(t, err)
	require.False(t, final.HTTPEnabled)
}
