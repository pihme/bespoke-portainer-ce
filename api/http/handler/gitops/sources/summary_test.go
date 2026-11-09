package sources

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/datastore"
	gittypes "github.com/portainer/portainer/api/git/types"
	ceWorkflows "github.com/portainer/portainer/api/gitops/workflows"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/require"
)

func TestSourcesSummary_Empty(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandler(t, store)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildSummaryReq(t, 1))

	require.Equal(t, http.StatusOK, rr.Code)

	var summary ceWorkflows.StatusSummary
	err := json.NewDecoder(rr.Body).Decode(&summary)
	require.NoError(t, err)
	require.Equal(t, ceWorkflows.StatusSummary{}, summary)
}

func TestSourcesSummary_CountsByStatus(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		for idx, name := range []string{"source-a", "source-b", "source-c"} {
			err := tx.Source().Create(adminUserContext, &portainer.Source{Name: name, Type: portainer.SourceTypeGit, Git: &gittypes.GitSource{URL: fmt.Sprintf("http://github.com/org/repo%d", idx)}})
			require.NoError(t, err)
		}

		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandler(t, store)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildSummaryReq(t, 1))

	require.Equal(t, http.StatusOK, rr.Code)

	var summary ceWorkflows.StatusSummary
	err := json.NewDecoder(rr.Body).Decode(&summary)
	require.NoError(t, err)
	require.Equal(t, 3, summary.Unknown)
	require.Zero(t, summary.Healthy)
	require.Zero(t, summary.Error)
	require.Zero(t, summary.Syncing)
	require.Zero(t, summary.Paused)
}

func TestREQ_GIT_02_SourcesSummary_HealthyAndError(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		healthy := &portainer.Source{
			Name:   "healthy-compose",
			Type:   portainer.SourceTypeGit,
			Git:    &gittypes.GitSource{URL: "https://github.com/org/healthy"},
			Status: portainer.SourceStatusHealthy,
		}
		require.NoError(t, tx.Source().Create(adminUserContext, healthy))

		errored := &portainer.Source{
			Name:        "error-compose",
			Type:        portainer.SourceTypeGit,
			Git:         &gittypes.GitSource{URL: "https://github.com/org/error"},
			Status:      portainer.SourceStatusError,
			StatusError: "clone failed",
		}
		require.NoError(t, tx.Source().Create(adminUserContext, errored))

		unknown := &portainer.Source{
			Name:   "unknown-compose",
			Type:   portainer.SourceTypeGit,
			Git:    &gittypes.GitSource{URL: "https://github.com/org/unknown"},
			Status: portainer.SourceStatusUnknown,
		}
		require.NoError(t, tx.Source().Create(adminUserContext, unknown))

		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandler(t, store)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildSummaryReq(t, 1))
	require.Equal(t, http.StatusOK, rr.Code)

	var summary ceWorkflows.StatusSummary
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&summary))
	require.Equal(t, 1, summary.Healthy)
	require.Equal(t, 1, summary.Error)
	require.Equal(t, 1, summary.Unknown)
	require.Zero(t, summary.Syncing)
	require.Zero(t, summary.Paused)
}
