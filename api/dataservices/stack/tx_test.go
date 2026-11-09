package stack_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/errors"
	"github.com/portainer/portainer/api/datastore"
	gittypes "github.com/portainer/portainer/api/git/types"

	"github.com/stretchr/testify/require"
)

// TestREQ_STK_02_TxCreateUpdateLocalComposeStack covers transactional create/update
// including the GitConfig warn arms.
func TestREQ_STK_02_TxCreateUpdateLocalComposeStack(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	var id portainer.StackID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		id = portainer.StackID(tx.Stack().GetNextIdentifier())
		st := composeStack(id, "tx-web")
		st.GitConfig = &gittypes.RepoConfig{URL: "https://example.test/tx.git"}
		return tx.Stack().Create(st)
	}))

	var got *portainer.Stack
	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		var err error
		got, err = tx.Stack().Read(id)
		return err
	}))
	require.Equal(t, "tx-web", got.Name)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		got.Name = "tx-web-renamed"
		got.GitConfig = &gittypes.RepoConfig{URL: "https://example.test/tx2.git"}
		return tx.Stack().Update(id, got)
	}))

	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		var err error
		got, err = tx.Stack().Read(id)
		return err
	}))
	require.Equal(t, "tx-web-renamed", got.Name)
}

// TestREQ_STK_01_TxStackByNameAndStacksByName covers transactional name lookups.
func TestREQ_STK_01_TxStackByNameAndStacksByName(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		id1 := portainer.StackID(tx.Stack().GetNextIdentifier())
		if err := tx.Stack().Create(composeStack(id1, "tx-shared")); err != nil {
			return err
		}
		id2 := portainer.StackID(tx.Stack().GetNextIdentifier())
		return tx.Stack().Create(composeStack(id2, "tx-shared"))
	}))

	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		one, err := tx.Stack().StackByName("tx-shared")
		require.NoError(t, err)
		require.Equal(t, "tx-shared", one.Name)

		many, err := tx.Stack().StacksByName("tx-shared")
		require.NoError(t, err)
		require.Len(t, many, 2)

		_, err = tx.Stack().StackByName("missing")
		require.ErrorIs(t, err, errors.ErrObjectNotFound)

		none, err := tx.Stack().StacksByName("missing")
		require.NoError(t, err)
		require.Empty(t, none)
		return nil
	}))
}

// TestREQ_STK_09_TxStackByWebhookID covers transactional webhook lookup.
func TestREQ_STK_09_TxStackByWebhookID(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	var id portainer.StackID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		id = portainer.StackID(tx.Stack().GetNextIdentifier())
		st := composeStack(id, "tx-hook")
		st.AutoUpdate = &portainer.AutoUpdateSettings{Webhook: "Tx-Hook-1"}
		if err := tx.Stack().Create(st); err != nil {
			return err
		}
		id2 := portainer.StackID(tx.Stack().GetNextIdentifier())
		return tx.Stack().Create(composeStack(id2, "tx-plain"))
	}))

	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		got, err := tx.Stack().StackByWebhookID("tx-hook-1")
		require.NoError(t, err)
		require.Equal(t, id, got.ID)

		_, err = tx.Stack().StackByWebhookID("absent")
		require.ErrorIs(t, err, errors.ErrObjectNotFound)
		return nil
	}))
}
