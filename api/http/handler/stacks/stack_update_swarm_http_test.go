package stacks

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices/source"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	gittypes "github.com/portainer/portainer/api/git/types"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/api/stacks/stackutils"
	"github.com/portainer/portainer/pkg/fips"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_STK_04_UpdateSwarmStack_HTTP_PersistsPruneAndEnv(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	_, store := datastore.MustNewTestStore(t, true, false)
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	_, err = mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	stack := &portainer.Stack{
		ID: 1, Name: "swarm-upd", Type: portainer.DockerSwarmStack, EndpointID: endpoint.ID,
		EntryPoint: "docker-compose.yml", ProjectPath: fileService.GetDatastorePath() + "/compose/1",
		Status: portainer.StackStatusActive, SwarmID: "s1",
	}
	require.NoError(t, store.Stack().Create(stack))
	require.NoError(t, store.ResourceControl().Create(&portainer.ResourceControl{
		ID: 1, ResourceID: stackutils.ResourceControlID(endpoint.ID, stack.Name),
		Type: portainer.StackResourceControl, AdministratorsOnly: false,
	}))
	_, err = fileService.StoreStackFileFromBytes(strconv.Itoa(int(stack.ID)), stack.EntryPoint, []byte("services:\n  web:\n    image: alpine:1\n"))
	require.NoError(t, err)

	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.FileService = fileService
	h.StackDeployer = testhelpers.NewTestStackDeployer()
	h.SwarmStackManager = swarmStackManager{}

	payload := updateSwarmStackPayload{
		StackFileContent: "services:\n  web:\n    image: alpine:2\n",
		Env:              []portainer.Pair{{Name: "S", Value: "1"}},
		Prune:            true,
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)
	req := mockCreateStackRequestWithSecurityContext(
		http.MethodPut, fmt.Sprintf("/stacks/%d?endpointId=%d", stack.ID, endpoint.ID), bytes.NewReader(body),
	)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	updated, err := store.Stack().Read(stack.ID)
	require.NoError(t, err)
	assert.Equal(t, []portainer.Pair{{Name: "S", Value: "1"}}, updated.Env)
	require.NotNil(t, updated.Option)
	assert.True(t, updated.Option.Prune)
}

func TestREQ_STK_04_UpdateGit_SwarmStack_SetsPruneOption(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint := &portainer.Endpoint{
		ID: 1, Name: "docker", Type: portainer.DockerEnvironment,
		SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: true},
	}
	require.NoError(t, store.Endpoint().Create(endpoint))

	admin := source.InsecureNewAdminContext()
	src := &portainer.Source{Type: portainer.SourceTypeGit, Git: &gittypes.GitSource{URL: "https://example.com/s.git"}}
	require.NoError(t, store.Source().Create(admin, src))
	wf := &portainer.Workflow{Artifacts: []portainer.Artifact{{
		StackID: 10, Files: []portainer.ArtifactFile{{SourceID: src.ID, Path: "docker-compose.yml", Hash: "h"}},
	}}}
	require.NoError(t, store.Workflow().Create(wf))
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 10, Name: "swarm-git", Type: portainer.DockerSwarmStack, EndpointID: endpoint.ID,
		WorkflowID: wf.ID, Status: portainer.StackStatusActive, ProjectPath: t.TempDir(),
		EntryPoint: "docker-compose.yml", SwarmID: "sw",
	}))

	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.GitService = testhelpers.NewGitService(nil, "h")
	payload := stackGitUpdatePayload{
		SourceID: src.ID, RepositoryReferenceName: "refs/heads/main", Prune: true,
		ConfigFilePath: "docker-compose.yml",
	}
	body, err := json.Marshal(payload)
	require.NoError(t, err)
	url := fmt.Sprintf("/stacks/10/git?endpointId=%d", endpoint.ID)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, mockCreateStackRequestWithSecurityContext(http.MethodPost, url, bytes.NewReader(body)))
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	updated, err := store.Stack().Read(10)
	require.NoError(t, err)
	require.NotNil(t, updated.Option)
	assert.True(t, updated.Option.Prune)
}
