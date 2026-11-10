package version_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/database/models"

	"github.com/stretchr/testify/require"
)

// TestTxVersionReadWriteUpdateRoundTrip covers transactional Version/UpdateVersion.
func TestTxVersionReadWriteUpdateRoundTrip(t *testing.T) {
	t.Parallel()
	conn, svc := openVersionService(t)

	require.Error(t, conn.ViewTx(func(tx portainer.Transaction) error {
		_, err := svc.Tx(tx).Version()
		return err
	}))

	require.NoError(t, conn.UpdateTx(func(tx portainer.Transaction) error {
		return svc.Tx(tx).UpdateVersion(&models.Version{
			SchemaVersion: "2.41.0",
			MigratorCount: 1,
			Edition:       int(portainer.PortainerCE),
			InstanceID:    "tx-a",
		})
	}))

	require.NoError(t, conn.ViewTx(func(tx portainer.Transaction) error {
		got, err := svc.Tx(tx).Version()
		require.NoError(t, err)
		require.Equal(t, "2.41.0", got.SchemaVersion)
		require.Equal(t, "tx-a", got.InstanceID)
		return nil
	}))

	require.NoError(t, conn.UpdateTx(func(tx portainer.Transaction) error {
		stx := svc.Tx(tx)
		got, err := stx.Version()
		if err != nil {
			return err
		}
		got.SchemaVersion = "2.45.3"
		got.InstanceID = "tx-b"
		return stx.UpdateVersion(got)
	}))

	require.NoError(t, conn.ViewTx(func(tx portainer.Transaction) error {
		got, err := svc.Tx(tx).Version()
		require.NoError(t, err)
		require.Equal(t, "2.45.3", got.SchemaVersion)
		require.Equal(t, "tx-b", got.InstanceID)
		return nil
	}))
}
