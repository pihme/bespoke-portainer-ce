package version_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/database/boltdb"
	"github.com/portainer/portainer/api/database/models"
	"github.com/portainer/portainer/api/dataservices/version"
	"github.com/portainer/portainer/api/logs"

	"github.com/stretchr/testify/require"
)

func openVersionService(t *testing.T) (portainer.Connection, *version.Service) {
	t.Helper()
	conn := &boltdb.DbConnection{Path: t.TempDir()}
	require.NoError(t, conn.Open())
	t.Cleanup(func() { logs.CloseAndLogErr(conn) })

	svc, err := version.NewService(conn)
	require.NoError(t, err)
	require.NotNil(t, svc)
	return conn, svc
}

func seedVersion(t *testing.T, svc *version.Service, v *models.Version) {
	t.Helper()
	require.NoError(t, svc.UpdateVersion(v))
}

// TestVersionReadWriteUpdateRoundTrip persists and reloads the version object,
// then updates schema/edition/instance fields.
func TestVersionReadWriteUpdateRoundTrip(t *testing.T) {
	t.Parallel()
	_, svc := openVersionService(t)

	_, err := svc.Version()
	require.Error(t, err)

	seed := &models.Version{
		SchemaVersion: "2.40.0",
		MigratorCount: 3,
		Edition:       int(portainer.PortainerCE),
		InstanceID:    "instance-a",
	}
	seedVersion(t, svc, seed)

	got, err := svc.Version()
	require.NoError(t, err)
	require.Equal(t, "2.40.0", got.SchemaVersion)
	require.Equal(t, 3, got.MigratorCount)
	require.Equal(t, int(portainer.PortainerCE), got.Edition)
	require.Equal(t, "instance-a", got.InstanceID)

	got.SchemaVersion = "2.45.3"
	got.MigratorCount = 4
	got.Edition = int(portainer.PortainerBE)
	got.InstanceID = "instance-b"
	require.NoError(t, svc.UpdateVersion(got))

	updated, err := svc.Version()
	require.NoError(t, err)
	require.Equal(t, "2.45.3", updated.SchemaVersion)
	require.Equal(t, 4, updated.MigratorCount)
	require.Equal(t, int(portainer.PortainerBE), updated.Edition)
	require.Equal(t, "instance-b", updated.InstanceID)
}

// TestSchemaVersionAndEditionHelpers reads and updates schema version and edition
// through the dedicated helpers.
func TestSchemaVersionAndEditionHelpers(t *testing.T) {
	t.Parallel()
	_, svc := openVersionService(t)

	_, err := svc.SchemaVersion()
	require.Error(t, err)
	_, err = svc.Edition()
	require.Error(t, err)
	require.Error(t, svc.UpdateSchemaVersion("2.41.0"))

	seedVersion(t, svc, &models.Version{
		SchemaVersion: "2.40.0",
		Edition:       int(portainer.PortainerCE),
	})

	schema, err := svc.SchemaVersion()
	require.NoError(t, err)
	require.Equal(t, "2.40.0", schema)

	edition, err := svc.Edition()
	require.NoError(t, err)
	require.Equal(t, portainer.PortainerCE, edition)

	require.NoError(t, svc.UpdateSchemaVersion("2.45.3"))
	schema, err = svc.SchemaVersion()
	require.NoError(t, err)
	require.Equal(t, "2.45.3", schema)

	require.NoError(t, svc.UpdateVersion(&models.Version{
		SchemaVersion: "2.45.3",
		Edition:       int(portainer.PortainerBE),
	}))
	edition, err = svc.Edition()
	require.NoError(t, err)
	require.Equal(t, portainer.PortainerBE, edition)
}

// TestInstanceIDCreateAndUpdate covers InstanceID read, create-on-missing, and update.
func TestInstanceIDCreateAndUpdate(t *testing.T) {
	t.Parallel()
	_, svc := openVersionService(t)

	_, err := svc.InstanceID()
	require.Error(t, err)

	// No version row yet: UpdateInstanceID creates one.
	require.NoError(t, svc.UpdateInstanceID("first-id"))
	id, err := svc.InstanceID()
	require.NoError(t, err)
	require.Equal(t, "first-id", id)

	got, err := svc.Version()
	require.NoError(t, err)
	require.Equal(t, "first-id", got.InstanceID)
	require.Empty(t, got.SchemaVersion)

	require.NoError(t, svc.UpdateInstanceID("second-id"))
	id, err = svc.InstanceID()
	require.NoError(t, err)
	require.Equal(t, "second-id", id)
}

// TestIsUpdatingFlagStoreAndClear covers the DB_UPDATING flag: missing means false,
// StoreIsUpdating(true) sets it, StoreIsUpdating(false) clears it.
func TestIsUpdatingFlagStoreAndClear(t *testing.T) {
	t.Parallel()
	conn, svc := openVersionService(t)

	updating, err := svc.IsUpdating()
	require.NoError(t, err)
	require.False(t, updating)

	require.NoError(t, svc.StoreIsUpdating(true))
	updating, err = svc.IsUpdating()
	require.NoError(t, err)
	require.True(t, updating)

	// Stored false value (not via StoreIsUpdating) still returns false without error.
	require.NoError(t, conn.UpdateObject(version.BucketName, []byte("DB_UPDATING"), false))
	updating, err = svc.IsUpdating()
	require.NoError(t, err)
	require.False(t, updating)

	require.NoError(t, svc.StoreIsUpdating(true))
	require.NoError(t, svc.StoreIsUpdating(false))
	updating, err = svc.IsUpdating()
	require.NoError(t, err)
	require.False(t, updating)
}

// TestTxWrapsConnectionForVersionHelpers builds a ServiceTx and exercises the
// connection wiring used by transactional version helpers.
func TestTxWrapsConnectionForVersionHelpers(t *testing.T) {
	t.Parallel()
	conn, svc := openVersionService(t)

	seedVersion(t, svc, &models.Version{
		SchemaVersion: "2.44.0",
		Edition:       int(portainer.PortainerCE),
		InstanceID:    "tx-seed",
	})

	require.NoError(t, conn.ViewTx(func(tx portainer.Transaction) error {
		stx := svc.Tx(tx)
		v, err := stx.Version()
		require.NoError(t, err)
		require.Equal(t, "tx-seed", v.InstanceID)
		schema, err := stx.SchemaVersion()
		require.NoError(t, err)
		require.Equal(t, "2.44.0", schema)
		edition, err := stx.Edition()
		require.NoError(t, err)
		require.Equal(t, portainer.PortainerCE, edition)
		id, err := stx.InstanceID()
		require.NoError(t, err)
		require.Equal(t, "tx-seed", id)
		return nil
	}))
}
