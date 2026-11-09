package settings_test

import (
	"testing"

	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/settings"
	"github.com/portainer/portainer/api/datastore"
	"github.com/stretchr/testify/require"
)

func TestSettingsReadUpdateAndTx(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	svc, err := settings.NewService(store.Connection())
	require.NoError(t, err)
	require.Equal(t, settings.BucketName, svc.BucketName())

	got, err := store.Settings().Settings()
	require.NoError(t, err)
	require.NotNil(t, got)

	got.LogoURL = "https://example.test/logo.png"
	got.SnapshotInterval = "7m"
	require.NoError(t, store.Settings().UpdateSettings(got))

	updated, err := store.Settings().Settings()
	require.NoError(t, err)
	require.Equal(t, "https://example.test/logo.png", updated.LogoURL)
	require.Equal(t, "7m", updated.SnapshotInterval)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		s, err := tx.Settings().Settings()
		if err != nil {
			return err
		}
		require.Equal(t, "7m", s.SnapshotInterval)
		s.TemplatesURL = "https://example.test/templates.json"
		require.Equal(t, settings.BucketName, tx.Settings().BucketName())
		return tx.Settings().UpdateSettings(s)
	}))

	final, err := store.Settings().Settings()
	require.NoError(t, err)
	require.Equal(t, "https://example.test/templates.json", final.TemplatesURL)
}
