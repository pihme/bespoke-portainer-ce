package workflows

import (
	"strconv"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/datastore"
	gittypes "github.com/portainer/portainer/api/git/types"
	"github.com/portainer/portainer/api/http/security"

	"github.com/stretchr/testify/require"
)

func adminContext() *security.RestrictedRequestContext {
	return &security.RestrictedRequestContext{
		IsAdmin: true,
		UserID:  1,
		User:    &portainer.User{ID: 1, Role: portainer.AdministratorRole},
	}
}

func TestAddSourceStats_NoOp(t *testing.T) {
	t.Parallel()

	result := make(map[portainer.SourceID]SourceStats)
	addSourceStats(result, nil, nil)

	require.Empty(t, result)
}

func TestAddSourceStats_AccumulatesWorkflowCount(t *testing.T) {
	t.Parallel()

	result := make(map[portainer.SourceID]SourceStats)
	addSourceStats(result, []portainer.SourceID{1}, nil)
	addSourceStats(result, []portainer.SourceID{1}, nil)

	require.Equal(t, 2, result[1].WorkflowCount)
}

func TestAddSourceStats_CollectsUniqueEndpointIDs(t *testing.T) {
	t.Parallel()

	result := make(map[portainer.SourceID]SourceStats)
	addSourceStats(result, []portainer.SourceID{1}, []portainer.EndpointID{10, 20})
	addSourceStats(result, []portainer.SourceID{1}, []portainer.EndpointID{20, 30})

	require.Len(t, result[1].EndpointIDs, 3)
	require.True(t, result[1].EndpointIDs[10])
	require.True(t, result[1].EndpointIDs[20])
	require.True(t, result[1].EndpointIDs[30])
}

func TestAddSourceStats_MultipleSourceIDs(t *testing.T) {
	t.Parallel()

	result := make(map[portainer.SourceID]SourceStats)
	addSourceStats(result, []portainer.SourceID{1, 2}, []portainer.EndpointID{10})

	require.Equal(t, 1, result[1].WorkflowCount)
	require.Equal(t, 1, result[2].WorkflowCount)
	require.True(t, result[1].EndpointIDs[10])
	require.True(t, result[2].EndpointIDs[10])
}

func TestFetchSourceStats_TracksWorkflowCountAndEndpoints(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	var srcID portainer.SourceID

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		src := &portainer.Source{Name: "shared", Type: portainer.SourceTypeGit, Git: &gittypes.GitSource{URL: "http://github.com/org/repo"}}
		require.NoError(t, tx.Source().Create(adminUserContext, src))
		srcID = src.ID

		for i := 1; i <= 2; i++ {
			wf := &portainer.Workflow{Artifacts: []portainer.Artifact{{Files: []portainer.ArtifactFile{{SourceID: srcID}}}}}
			require.NoError(t, tx.Workflow().Create(wf))
			require.NoError(t, tx.Stack().Create(&portainer.Stack{
				ID:         portainer.StackID(i),
				Name:       "stack-" + strconv.Itoa(i),
				EndpointID: portainer.EndpointID(i),
				WorkflowID: wf.ID,
			}))
		}

		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	var stats map[portainer.SourceID]SourceStats
	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		var err error
		stats, err = FetchSourceStats(tx, adminContext())

		return err
	}))

	st := stats[srcID]
	require.Equal(t, 2, st.WorkflowCount)
	require.Len(t, st.EndpointIDs, 2)
}

func TestFetchSourceStats_UnusedSourceHasZeroStats(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	var unusedID portainer.SourceID

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		src := &portainer.Source{Name: "unused", Type: portainer.SourceTypeGit, Git: &gittypes.GitSource{URL: "http://github.com/org/repo"}}
		require.NoError(t, tx.Source().Create(adminUserContext, src))
		unusedID = src.ID

		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	var stats map[portainer.SourceID]SourceStats
	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		var err error
		stats, err = FetchSourceStats(tx, adminContext())

		return err
	}))

	st := stats[unusedID]
	require.Zero(t, st.WorkflowCount)
	require.Empty(t, st.EndpointIDs)
}
