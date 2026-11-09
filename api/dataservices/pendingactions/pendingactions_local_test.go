package pendingactions_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/pendingactions"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

func TestNewServiceAndGetNextIdentifier(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc, err := pendingactions.NewService(store.GetConnection())
	require.NoError(t, err)
	require.NotNil(t, svc)
	require.Greater(t, svc.GetNextIdentifier(), 0)
}

func TestUpdatePendingAction(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc := store.PendingActions()

	action := &portainer.PendingAction{EndpointID: 1, Action: "test-action"}
	require.NoError(t, svc.Create(action))
	require.NotZero(t, action.ID)

	action.Action = "updated-action"
	require.NoError(t, svc.Update(action.ID, action))

	got, err := svc.Read(action.ID)
	require.NoError(t, err)
	require.Equal(t, "updated-action", got.Action)
}

func TestUpdateAndGetNextIdentifierInTransaction(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)

	var id portainer.PendingActionID
	var next int
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		action := &portainer.PendingAction{EndpointID: 3, Action: "tx-create"}
		if err := tx.PendingActions().Create(action); err != nil {
			return err
		}
		id = action.ID
		action.Action = "tx-updated"
		if err := tx.PendingActions().Update(id, action); err != nil {
			return err
		}
		next = tx.PendingActions().GetNextIdentifier()
		return nil
	}))
	require.NotZero(t, id)
	require.Greater(t, next, 0)

	got, err := store.PendingActions().Read(id)
	require.NoError(t, err)
	require.Equal(t, "tx-updated", got.Action)
}

func TestDeleteByEndpointID_NoMatchingActions(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	require.NoError(t, store.PendingActions().Create(&portainer.PendingAction{EndpointID: 5}))
	require.NoError(t, store.PendingActions().DeleteByEndpointID(99))
	all, err := store.PendingActions().ReadAll()
	require.NoError(t, err)
	require.Len(t, all, 1)
}
