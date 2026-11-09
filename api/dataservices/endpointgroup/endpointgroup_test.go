package endpointgroup_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/endpointgroup"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

func TestNewService(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc, err := endpointgroup.NewService(store.GetConnection())
	require.NoError(t, err)
	require.NotNil(t, svc)
	require.Equal(t, endpointgroup.BucketName, svc.Bucket)
}

func TestCreateReadUpdateDeleteEndpointGroup(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc := store.EndpointGroup()

	group := &portainer.EndpointGroup{
		Name:        "local-docker",
		Description: "local environments",
		TagIDs:      []portainer.TagID{},
	}
	require.NoError(t, svc.Create(group))
	require.NotZero(t, group.ID)

	got, err := svc.Read(group.ID)
	require.NoError(t, err)
	require.Equal(t, "local-docker", got.Name)
	require.Equal(t, "local environments", got.Description)

	got.Description = "updated"
	require.NoError(t, svc.Update(group.ID, got))
	updated, err := svc.Read(group.ID)
	require.NoError(t, err)
	require.Equal(t, "updated", updated.Description)

	all, err := svc.ReadAll()
	require.NoError(t, err)
	require.NotEmpty(t, all)

	require.NoError(t, svc.Delete(group.ID))
	_, err = svc.Read(group.ID)
	require.Error(t, err)
}

func TestCreateEndpointGroupInTransaction(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)

	var id portainer.EndpointGroupID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		group := &portainer.EndpointGroup{Name: "tx-group", Description: "via tx"}
		if err := tx.EndpointGroup().Create(group); err != nil {
			return err
		}
		id = group.ID
		return nil
	}))
	require.NotZero(t, id)

	got, err := store.EndpointGroup().Read(id)
	require.NoError(t, err)
	require.Equal(t, "tx-group", got.Name)
}

func TestServiceTxViaConcreteTx(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc, err := endpointgroup.NewService(store.GetConnection())
	require.NoError(t, err)

	var id portainer.EndpointGroupID
	require.NoError(t, store.GetConnection().UpdateTx(func(tx portainer.Transaction) error {
		stx := svc.Tx(tx)
		group := &portainer.EndpointGroup{Name: "concrete", Description: "d"}
		if err := stx.Create(group); err != nil {
			return err
		}
		id = group.ID
		return nil
	}))
	require.NotZero(t, id)
}
