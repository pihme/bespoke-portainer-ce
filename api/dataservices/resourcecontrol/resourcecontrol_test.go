package resourcecontrol_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/resourcecontrol"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

func TestNewServiceAndBucketName(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	svc, err := resourcecontrol.NewService(store.Connection())
	require.NoError(t, err)
	require.Equal(t, resourcecontrol.BucketName, svc.BucketName())
}

func TestCreateReadUpdateDeleteResourceControl(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	rc := &portainer.ResourceControl{
		ResourceID: "container-abc",
		Type:       portainer.ContainerResourceControl,
		Public:     true,
	}
	require.NoError(t, store.ResourceControl().Create(rc))
	require.NotZero(t, rc.ID)

	got, err := store.ResourceControl().Read(rc.ID)
	require.NoError(t, err)
	require.Equal(t, "container-abc", got.ResourceID)
	require.Equal(t, portainer.ContainerResourceControl, got.Type)
	require.True(t, got.Public)

	got.Public = false
	got.UserAccesses = []portainer.UserResourceAccess{{UserID: 1, AccessLevel: portainer.ReadWriteAccessLevel}}
	require.NoError(t, store.ResourceControl().Update(rc.ID, got))

	updated, err := store.ResourceControl().Read(rc.ID)
	require.NoError(t, err)
	require.False(t, updated.Public)
	require.Len(t, updated.UserAccesses, 1)

	require.NoError(t, store.ResourceControl().Delete(rc.ID))
	_, err = store.ResourceControl().Read(rc.ID)
	require.Error(t, err)
	require.True(t, dataservices.IsErrObjectNotFound(err))
}

func TestResourceControlByResourceIDAndType(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	vol := &portainer.ResourceControl{
		ResourceID:     "vol-main",
		SubResourceIDs: []string{"vol-sub-a", "vol-sub-b"},
		Type:           portainer.VolumeResourceControl,
		Public:         true,
	}
	require.NoError(t, store.ResourceControl().Create(vol))

	net := &portainer.ResourceControl{
		ResourceID: "net-bridge",
		Type:       portainer.NetworkResourceControl,
		Public:     true,
	}
	require.NoError(t, store.ResourceControl().Create(net))

	byMain, err := store.ResourceControl().ResourceControlByResourceIDAndType("vol-main", portainer.VolumeResourceControl)
	require.NoError(t, err)
	require.NotNil(t, byMain)
	require.Equal(t, vol.ID, byMain.ID)

	bySub, err := store.ResourceControl().ResourceControlByResourceIDAndType("vol-sub-b", portainer.VolumeResourceControl)
	require.NoError(t, err)
	require.NotNil(t, bySub)
	require.Equal(t, vol.ID, bySub.ID)

	// SubResource match does not require type equality in the predicate's second arm.
	bySubAnyType, err := store.ResourceControl().ResourceControlByResourceIDAndType("vol-sub-a", portainer.ContainerResourceControl)
	require.NoError(t, err)
	require.NotNil(t, bySubAnyType)

	missing, err := store.ResourceControl().ResourceControlByResourceIDAndType("missing", portainer.VolumeResourceControl)
	require.NoError(t, err)
	require.Nil(t, missing)

	wrongType, err := store.ResourceControl().ResourceControlByResourceIDAndType("vol-main", portainer.NetworkResourceControl)
	require.NoError(t, err)
	require.Nil(t, wrongType)

	byNet, err := store.ResourceControl().ResourceControlByResourceIDAndType("net-bridge", portainer.NetworkResourceControl)
	require.NoError(t, err)
	require.NotNil(t, byNet)
	require.Equal(t, net.ID, byNet.ID)
}

func TestResourceControlTxCreateAndLookup(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	var createdID portainer.ResourceControlID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		rc := &portainer.ResourceControl{
			ResourceID:     "stack-compose",
			SubResourceIDs: []string{"svc-web"},
			Type:           portainer.StackResourceControl,
			Public:         true,
		}
		if err := tx.ResourceControl().Create(rc); err != nil {
			return err
		}
		createdID = rc.ID

		got, err := tx.ResourceControl().ResourceControlByResourceIDAndType("stack-compose", portainer.StackResourceControl)
		if err != nil {
			return err
		}
		require.NotNil(t, got)
		require.Equal(t, createdID, got.ID)

		bySub, err := tx.ResourceControl().ResourceControlByResourceIDAndType("svc-web", portainer.StackResourceControl)
		if err != nil {
			return err
		}
		require.NotNil(t, bySub)

		missing, err := tx.ResourceControl().ResourceControlByResourceIDAndType("no-such", portainer.StackResourceControl)
		if err != nil {
			return err
		}
		require.Nil(t, missing)
		return nil
	}))

	got, err := store.ResourceControl().Read(createdID)
	require.NoError(t, err)
	require.Equal(t, "stack-compose", got.ResourceID)
}

func TestResourceControlReadAll(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	require.NoError(t, store.ResourceControl().Create(&portainer.ResourceControl{
		ResourceID: "c1",
		Type:       portainer.ContainerResourceControl,
		Public:     true,
	}))
	require.NoError(t, store.ResourceControl().Create(&portainer.ResourceControl{
		ResourceID: "c2",
		Type:       portainer.ContainerResourceControl,
		Public:     false,
	}))

	all, err := store.ResourceControl().ReadAll()
	require.NoError(t, err)
	require.Len(t, all, 2)

	publicOnly, err := store.ResourceControl().ReadAll(func(rc portainer.ResourceControl) bool {
		return rc.Public
	})
	require.NoError(t, err)
	require.Len(t, publicOnly, 1)
	require.Equal(t, "c1", publicOnly[0].ResourceID)
}
