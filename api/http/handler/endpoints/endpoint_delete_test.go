package endpoints

import (
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/proxy"
	"github.com/portainer/portainer/api/internal/testhelpers"

	"github.com/stretchr/testify/require"
)

func TestEndpointDeleteRemovesStaleWorkflowReference(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)

	handler := NewHandler(testhelpers.NewTestRequestBouncer())
	handler.DataStore = store
	handler.ProxyManager = proxy.NewManager(nil)
	handler.ProxyManager.NewProxyFactory(nil, nil, nil, nil, nil)

	err := store.Endpoint().Create(&portainer.Endpoint{
		ID:   1,
		Name: "env-1",
		Type: portainer.DockerEnvironment,
	})
	require.NoError(t, err)

	wf := &portainer.Workflow{
		Name: "Test Workflow",
		Artifacts: []portainer.Artifact{{
			EnvIDs: []portainer.EndpointID{1, 2},
		}},
	}

	err = store.Workflow().Create(wf)
	require.NoError(t, err)

	req, err := http.NewRequest(http.MethodDelete, "/endpoints/1", nil)
	require.NoError(t, err)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)

	updatedWorkflow, err := store.Workflow().Read(wf.ID)
	require.NoError(t, err)
	require.Len(t, updatedWorkflow.Artifacts, 1)
	require.Equal(t, []portainer.EndpointID{2}, updatedWorkflow.Artifacts[0].EnvIDs)
}
