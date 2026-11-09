package workflow_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/workflow"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

func TestNewService(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc, err := workflow.NewService(store.GetConnection())
	require.NoError(t, err)
	require.NotNil(t, svc)
	require.Equal(t, workflow.BucketName, svc.Bucket)
}

func TestCreateReadUpdateDeleteWorkflow(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc := store.Workflow()

	wf := &portainer.Workflow{
		Name: "local-gitops",
		Artifacts: []portainer.Artifact{
			{StackID: 11, Files: []portainer.ArtifactFile{{SourceID: 1}}},
		},
	}
	require.NoError(t, svc.Create(wf))
	require.NotZero(t, wf.ID)

	got, err := svc.Read(wf.ID)
	require.NoError(t, err)
	require.Equal(t, "local-gitops", got.Name)
	require.Len(t, got.Artifacts, 1)
	require.Equal(t, portainer.StackID(11), got.Artifacts[0].StackID)

	got.Name = "local-gitops-renamed"
	require.NoError(t, svc.Update(wf.ID, got))
	updated, err := svc.Read(wf.ID)
	require.NoError(t, err)
	require.Equal(t, "local-gitops-renamed", updated.Name)

	all, err := svc.ReadAll()
	require.NoError(t, err)
	require.NotEmpty(t, all)

	require.NoError(t, svc.Delete(wf.ID))
	_, err = svc.Read(wf.ID)
	require.Error(t, err)
}

func TestCreateWorkflowInTransaction(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)

	var id portainer.WorkflowID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		wf := &portainer.Workflow{Name: "tx-workflow"}
		if err := tx.Workflow().Create(wf); err != nil {
			return err
		}
		id = wf.ID
		return nil
	}))
	require.NotZero(t, id)

	got, err := store.Workflow().Read(id)
	require.NoError(t, err)
	require.Equal(t, "tx-workflow", got.Name)
}

func TestServiceTxViaConcreteTx(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc, err := workflow.NewService(store.GetConnection())
	require.NoError(t, err)

	var id portainer.WorkflowID
	require.NoError(t, store.GetConnection().UpdateTx(func(tx portainer.Transaction) error {
		stx := svc.Tx(tx)
		wf := &portainer.Workflow{Name: "concrete-tx"}
		if err := stx.Create(wf); err != nil {
			return err
		}
		id = wf.ID
		return nil
	}))
	require.NotZero(t, id)
}
