package stacks

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/pkg/fips"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// REQ-TAI-003: Docker Swarm is removed. A leftover Swarm stack record can still
// be listed, inspected and deleted, but every operation that would reach
// Docker Swarm (update, Git update, Git redeploy, start, stop, migrate) is
// refused with 400 and leaves the record unchanged.
func TestREQ_TAI_003_SwarmStackOperationsAreRejected(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)

	_, store := datastore.MustNewTestStore(t, true, false)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint := &portainer.Endpoint{
		ID: 1, Name: "docker", Type: portainer.DockerEnvironment,
		SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true},
	}
	require.NoError(t, store.Endpoint().Create(endpoint))
	other := &portainer.Endpoint{ID: 2, Name: "other", Type: portainer.DockerEnvironment}
	require.NoError(t, store.Endpoint().Create(other))

	stack := &portainer.Stack{
		ID: 1, Name: "swarm-left", Type: portainer.DockerSwarmStack, EndpointID: endpoint.ID,
		EntryPoint: "docker-compose.yml", ProjectPath: t.TempDir(), WorkflowID: 1,
		Status: portainer.StackStatusInactive, SwarmID: "sw",
	}
	require.NoError(t, store.Stack().Create(stack))

	deployer := testhelpers.NewTestStackDeployer()
	h := NewHandler(testhelpers.NewTestRequestBouncer(), &stubTeardown{})
	h.DataStore = store
	h.StackDeployer = deployer
	h.GitService = testhelpers.NewGitService(nil, "h")

	updateBody, _ := json.Marshal(updateComposeStackPayload{StackFileContent: "services:\n  web:\n    image: alpine\n"})
	gitBody, _ := json.Marshal(stackGitUpdatePayload{RepositoryReferenceName: "refs/heads/main"})
	redeployBody, _ := json.Marshal(stackGitRedeployPayload{RepositoryReferenceName: "refs/heads/main"})
	migrateBody, _ := json.Marshal(stackMigratePayload{EndpointID: int(other.ID)})

	requests := []struct {
		method, path string
		body         []byte
	}{
		{http.MethodPut, "/stacks/1", updateBody},
		{http.MethodPost, "/stacks/1/git", gitBody},
		{http.MethodPut, "/stacks/1/git/redeploy", redeployBody},
		{http.MethodPost, "/stacks/1/start", nil},
		{http.MethodPost, "/stacks/1/stop", nil},
		{http.MethodPost, "/stacks/1/migrate", migrateBody},
	}

	for _, r := range requests {
		url := fmt.Sprintf("%s?endpointId=%d", r.path, endpoint.ID)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(r.method, url, bytes.NewReader(r.body)))
		assert.Equal(t, http.StatusBadRequest, w.Code, "%s %s: %s", r.method, r.path, w.Body.String())
		assert.Contains(t, w.Body.String(), "Docker Swarm stacks are no longer supported", "%s %s", r.method, r.path)
	}

	unchanged, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, endpoint.ID, unchanged.EndpointID)
	assert.Equal(t, portainer.StackStatusInactive, unchanged.Status)
	assert.Zero(t, deployer.DeployComposeCallCount)
}
