package snapshot_test

import (
	"encoding/json"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/snapshot"
	"github.com/portainer/portainer/api/datastore"

	"github.com/docker/docker/api/types/system"
	"github.com/stretchr/testify/require"
)

func localDockerSnapshot(endpointID portainer.EndpointID, cpu int) *portainer.Snapshot {
	return &portainer.Snapshot{
		EndpointID: endpointID,
		Docker: &portainer.DockerSnapshot{
			Time:          1_700_000_000,
			DockerVersion: "27.0.0",
			TotalCPU:      cpu,
			TotalMemory:   8 * 1024 * 1024 * 1024,
			SnapshotRaw: portainer.DockerSnapshotRaw{
				Info: system.Info{ID: "docker-engine-1"},
			},
		},
	}
}

// TestREQ_ENV_12_CreateAndReadLocalDockerSnapshot persists a local Docker
// environment snapshot and reads it back through the datastore.
func TestREQ_ENV_12_CreateAndReadLocalDockerSnapshot(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	snap := localDockerSnapshot(7, 4)
	require.NoError(t, store.Snapshot().Create(snap))

	got, err := store.Snapshot().Read(7)
	require.NoError(t, err)
	require.Equal(t, portainer.EndpointID(7), got.EndpointID)
	require.NotNil(t, got.Docker)
	require.Equal(t, 4, got.Docker.TotalCPU)
	require.Equal(t, "27.0.0", got.Docker.DockerVersion)

	exists, err := store.Snapshot().Exists(7)
	require.NoError(t, err)
	require.True(t, exists)

	missing, err := store.Snapshot().Exists(99)
	require.NoError(t, err)
	require.False(t, missing)
}

// TestREQ_ENV_12_UpdateAndDeleteLocalDockerSnapshot updates CPU counts on a
// local Docker snapshot and then deletes it.
func TestREQ_ENV_12_UpdateAndDeleteLocalDockerSnapshot(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	snap := localDockerSnapshot(3, 2)
	require.NoError(t, store.Snapshot().Create(snap))

	snap.Docker.TotalCPU = 8
	require.NoError(t, store.Snapshot().Update(3, snap))

	got, err := store.Snapshot().Read(3)
	require.NoError(t, err)
	require.Equal(t, 8, got.Docker.TotalCPU)

	require.NoError(t, store.Snapshot().Delete(3))
	_, err = store.Snapshot().Read(3)
	require.Error(t, err)
	require.True(t, dataservices.IsErrObjectNotFound(err))
}

// TestREQ_ENV_12_ReadAllLocalDockerSnapshots lists every stored local Docker
// snapshot and filters by endpoint ID.
func TestREQ_ENV_12_ReadAllLocalDockerSnapshots(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	require.NoError(t, store.Snapshot().Create(localDockerSnapshot(1, 2)))
	require.NoError(t, store.Snapshot().Create(localDockerSnapshot(2, 4)))

	all, err := store.Snapshot().ReadAll()
	require.NoError(t, err)
	require.Len(t, all, 2)

	onlySecond, err := store.Snapshot().ReadAll(func(s portainer.Snapshot) bool {
		return s.EndpointID == 2
	})
	require.NoError(t, err)
	require.Len(t, onlySecond, 1)
	require.Equal(t, portainer.EndpointID(2), onlySecond[0].EndpointID)
	require.Equal(t, 4, onlySecond[0].Docker.TotalCPU)
}

// TestREQ_ENV_12_ReadWithoutSnapshotRawDropsDockerRaw strips DockerSnapshotRaw
// from a persisted local Docker snapshot while keeping summary fields.
func TestREQ_ENV_12_ReadWithoutSnapshotRawDropsDockerRaw(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	snap := localDockerSnapshot(11, 6)
	require.NoError(t, store.Snapshot().Create(snap))

	got, err := store.Snapshot().ReadWithoutSnapshotRaw(11)
	require.NoError(t, err)
	require.Equal(t, portainer.EndpointID(11), got.EndpointID)
	require.NotNil(t, got.Docker)
	require.Equal(t, 6, got.Docker.TotalCPU)
	require.Equal(t, "27.0.0", got.Docker.DockerVersion)
	require.Empty(t, got.Docker.SnapshotRaw.Info.ID)
	require.Nil(t, got.Kubernetes)
}

// TestREQ_ENV_12_ReadWithoutSnapshotRawMissing returns not-found for an
// unknown local Docker environment.
func TestREQ_ENV_12_ReadWithoutSnapshotRawMissing(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	_, err := store.Snapshot().ReadWithoutSnapshotRaw(404)
	require.Error(t, err)
	require.True(t, dataservices.IsErrObjectNotFound(err))
}

// TestREQ_ENV_12_ReadWithoutSnapshotRawNilDocker covers a snapshot row that
// has no Docker payload (summary-only record).
func TestREQ_ENV_12_ReadWithoutSnapshotRawNilDocker(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	require.NoError(t, store.Snapshot().Create(&portainer.Snapshot{EndpointID: 5}))

	got, err := store.Snapshot().ReadWithoutSnapshotRaw(5)
	require.NoError(t, err)
	require.Equal(t, portainer.EndpointID(5), got.EndpointID)
	require.Nil(t, got.Docker)
}

// TestREQ_ENV_12_CreateAndReadRawMessage round-trips a SnapshotRawMessage for
// a local Docker environment through CreateRawMessage/ReadRawMessage.
func TestREQ_ENV_12_CreateAndReadRawMessage(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	rawDocker, err := json.Marshal(map[string]any{
		"DockerVersion":     "27.1.0",
		"TotalCPU":          3,
		"DockerSnapshotRaw": map[string]any{"Info": map[string]any{"ID": "raw-1"}},
	})
	require.NoError(t, err)

	msg := &portainer.SnapshotRawMessage{
		EndpointID: 21,
		Docker:     rawDocker,
	}
	require.NoError(t, store.SnapshotService.CreateRawMessage(msg))

	got, err := store.SnapshotService.ReadRawMessage(21)
	require.NoError(t, err)
	require.Equal(t, portainer.EndpointID(21), got.EndpointID)
	require.JSONEq(t, string(rawDocker), string(got.Docker))

	_, err = store.SnapshotService.ReadRawMessage(404)
	require.Error(t, err)
	require.True(t, dataservices.IsErrObjectNotFound(err))
}

// TestREQ_ENV_12_TxCreateAndReadLocalDockerSnapshot covers the transactional
// Create path used when persisting a local Docker snapshot inside UpdateTx.
func TestREQ_ENV_12_TxCreateAndReadLocalDockerSnapshot(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		if err := tx.Snapshot().Create(localDockerSnapshot(31, 1)); err != nil {
			return err
		}
		got, err := tx.Snapshot().ReadWithoutSnapshotRaw(31)
		if err != nil {
			return err
		}
		require.Equal(t, portainer.EndpointID(31), got.EndpointID)
		require.Equal(t, 1, got.Docker.TotalCPU)
		return nil
	}))

	got, err := store.Snapshot().Read(31)
	require.NoError(t, err)
	require.Equal(t, 1, got.Docker.TotalCPU)
}

// TestREQ_ENV_12_TxCreateRawMessageAndRead covers ServiceTx CreateRawMessage
// and ReadRawMessage against the same BoltDB transaction.
func TestREQ_ENV_12_TxCreateRawMessageAndRead(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	rawDocker := json.RawMessage(`{"TotalCPU":12,"DockerVersion":"27.2.0"}`)

	require.NoError(t, store.Connection().UpdateTx(func(tx portainer.Transaction) error {
		svcTx := store.SnapshotService.Tx(tx)
		if err := svcTx.CreateRawMessage(&portainer.SnapshotRawMessage{
			EndpointID: 41,
			Docker:     rawDocker,
		}); err != nil {
			return err
		}
		got, err := svcTx.ReadRawMessage(41)
		if err != nil {
			return err
		}
		require.Equal(t, portainer.EndpointID(41), got.EndpointID)
		require.JSONEq(t, string(rawDocker), string(got.Docker))

		gotSnap, err := svcTx.ReadWithoutSnapshotRaw(41)
		if err != nil {
			return err
		}
		require.NotNil(t, gotSnap.Docker)
		require.Equal(t, 12, gotSnap.Docker.TotalCPU)
		return nil
	}))
}

// TestREQ_ENV_12_NewServiceAndBucketName constructs the snapshot service on an
// initialized connection and reports the snapshots bucket name.
func TestREQ_ENV_12_NewServiceAndBucketName(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	svc, err := snapshot.NewService(store.Connection())
	require.NoError(t, err)
	require.Equal(t, snapshot.BucketName, svc.BucketName())
	require.Equal(t, "snapshots", store.SnapshotService.BucketName())
}
