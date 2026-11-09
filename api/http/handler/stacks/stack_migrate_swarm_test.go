package stacks

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_STK_07_MigrateSwarmStack_ToNewEndpoint_Succeeds(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	_, err = mockCreateUser(store)
	require.NoError(t, err)
	src := &portainer.Endpoint{
		ID: 1, Name: "src", Type: portainer.DockerEnvironment,
		SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true},
	}
	dst := &portainer.Endpoint{
		ID: 2, Name: "dst", Type: portainer.DockerEnvironment,
		SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true},
	}
	require.NoError(t, store.Endpoint().Create(src))
	require.NoError(t, store.Endpoint().Create(dst))

	stack := &portainer.Stack{
		ID: 1, Name: "swarm-mig", Type: portainer.DockerSwarmStack, EndpointID: src.ID,
		EntryPoint: "docker-compose.yml", ProjectPath: fileService.GetDatastorePath() + "/compose/1",
		Status: portainer.StackStatusActive, SwarmID: "swarm1",
	}
	require.NoError(t, store.Stack().Create(stack))
	_, err = fileService.StoreStackFileFromBytes("1", "docker-compose.yml", []byte("services:\n  web:\n    image: alpine\n"))
	require.NoError(t, err)

	h := NewHandler(testhelpers.NewTestRequestBouncer(), &stubTeardown{})
	h.DataStore = store
	h.FileService = fileService
	h.StackDeployer = testhelpers.NewTestStackDeployer()
	h.SwarmStackManager = swarmStackManager{}

	body, _ := json.Marshal(stackMigratePayload{EndpointID: int(dst.ID), Name: "swarm-mig-new", SwarmID: "swarm2"})
	req := mockCreateStackRequestWithSecurityContext(http.MethodPost, "/stacks/1/migrate", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	updated, err := store.Stack().Read(1)
	require.NoError(t, err)
	assert.Equal(t, dst.ID, updated.EndpointID)
	assert.Equal(t, "swarm-mig-new", updated.Name)
	assert.Equal(t, "swarm2", updated.SwarmID)
}
