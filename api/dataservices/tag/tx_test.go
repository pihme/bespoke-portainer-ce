package tag_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/tag"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

func TestCreateInTransaction(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)

	var id portainer.TagID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		tagObj := &portainer.Tag{
			Name:           "tx-tag",
			Endpoints:      map[portainer.EndpointID]bool{},
			EndpointGroups: map[portainer.EndpointGroupID]bool{},
		}
		if err := tx.Tag().Create(tagObj); err != nil {
			return err
		}
		id = tagObj.ID
		return nil
	}))
	require.NotZero(t, id)

	got, err := store.Tag().Read(id)
	require.NoError(t, err)
	require.Equal(t, "tx-tag", got.Name)
}

func TestUpdateTagFuncInTransactionRejected(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)

	tagObj := &portainer.Tag{
		Name:           "before-tx",
		Endpoints:      map[portainer.EndpointID]bool{},
		EndpointGroups: map[portainer.EndpointGroupID]bool{},
	}
	require.NoError(t, store.Tag().Create(tagObj))

	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.Tag().UpdateTagFunc(tagObj.ID, func(tg *portainer.Tag) {
			tg.Name = "should-not-apply"
		})
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "cannot be called inside a transaction")

	got, err := store.Tag().Read(tagObj.ID)
	require.NoError(t, err)
	require.Equal(t, "before-tx", got.Name)
}

func TestServiceTxViaConcreteTx(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc, err := tag.NewService(store.GetConnection())
	require.NoError(t, err)

	var id portainer.TagID
	require.NoError(t, store.GetConnection().UpdateTx(func(tx portainer.Transaction) error {
		stx := svc.Tx(tx)
		tagObj := &portainer.Tag{
			Name:           "concrete-tx",
			Endpoints:      map[portainer.EndpointID]bool{1: true},
			EndpointGroups: map[portainer.EndpointGroupID]bool{},
		}
		if err := stx.Create(tagObj); err != nil {
			return err
		}
		id = tagObj.ID
		return nil
	}))
	require.NotZero(t, id)

	got, err := svc.Read(id)
	require.NoError(t, err)
	require.Equal(t, "concrete-tx", got.Name)
	require.True(t, got.Endpoints[1])
}
