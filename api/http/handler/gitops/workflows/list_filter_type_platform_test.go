package workflows

import (
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/datastore"
	ce "github.com/portainer/portainer/api/gitops/workflows"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_GIT_01_WorkflowsList_TypeAndPlatformFilter(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		createGitStack(t, tx, &portainer.Stack{
			ID: 1, Name: "compose-wf", Type: portainer.DockerComposeStack,
			GitConfig: gitConfig("https://github.com/x/compose"),
		})
		createGitStack(t, tx, &portainer.Stack{
			ID: 2, Name: "swarm-wf", Type: portainer.DockerSwarmStack,
			GitConfig: gitConfig("https://github.com/x/swarm"),
		})
		require.NoError(t, tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole}))
		return nil
	}))

	h := NewHandler(store, nil, nil)

	t.Run("type=stack keeps both local stack workflows", func(t *testing.T) {
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, buildWorkflowsReq(t, 1, portainer.AdministratorRole, "type=stack"))
		items := decodeWorkflows(t, rr)
		require.Len(t, items, 2)
	})

	t.Run("platform=dockerStandalone keeps compose only", func(t *testing.T) {
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, buildWorkflowsReq(t, 1, portainer.AdministratorRole, "platform=dockerStandalone"))
		items := decodeWorkflows(t, rr)
		require.Len(t, items, 1)
		assert.Equal(t, "compose-wf", items[0].Name)
	})

	t.Run("platform=dockerSwarm keeps swarm only", func(t *testing.T) {
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, buildWorkflowsReq(t, 1, portainer.AdministratorRole, "platform=dockerSwarm"))
		items := decodeWorkflows(t, rr)
		require.Len(t, items, 1)
		assert.Equal(t, "swarm-wf", items[0].Name)
	})
}

func TestHasArtifactMatching(t *testing.T) {
	t.Parallel()
	wf := ce.Workflow{Artifacts: []ce.ArtifactDetail{{
		WorkflowMappingFields: ce.WorkflowMappingFields{
			Type: ce.TypeStack, Platform: ce.DeploymentPlatformDockerStandalone,
		},
	}}}
	require.True(t, hasArtifactMatching(wf, func(a ce.ArtifactDetail) bool { return a.Type == ce.TypeStack }))
	require.False(t, hasArtifactMatching(wf, func(a ce.ArtifactDetail) bool {
		return a.Platform == ce.DeploymentPlatformKubernetes
	}))
	require.False(t, hasArtifactMatching(ce.Workflow{}, func(ce.ArtifactDetail) bool { return true }))
}

func TestWorkflowsList_InvalidEndpointIDs(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)
	require.NoError(t, store.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole}))
	h := NewHandler(store, nil, nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildWorkflowsReq(t, 1, portainer.AdministratorRole, "endpointIds[]=not-a-number"))
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}
