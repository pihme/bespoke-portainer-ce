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

func TestREQ_STK_04_UpdateCompose_ClearsAutoUpdateAndDetachesWorkflow(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	_, store := datastore.MustNewTestStore(t, true, false)
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	_, err = mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	admin := source.InsecureNewAdminContext()
	src := &portainer.Source{Type: portainer.SourceTypeGit, Git: &gittypes.GitSource{URL: "https://example.com/r.git"}}
	require.NoError(t, store.Source().Create(admin, src))
	wf := &portainer.Workflow{Artifacts: []portainer.Artifact{{
		StackID: 1,
		Files:   []portainer.ArtifactFile{{SourceID: src.ID, Path: "docker-compose.yml", Hash: "h"}},
	}}}
	require.NoError(t, store.Workflow().Create(wf))

	stack := &portainer.Stack{
		ID: 1, Name: "git-to-editor", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID,
		EntryPoint: "docker-compose.yml", ProjectPath: fileService.GetDatastorePath() + "/compose/1",
		Status: portainer.StackStatusActive, WorkflowID: wf.ID,
		AutoUpdate: &portainer.AutoUpdateSettings{Interval: "5m"},
		Option:     &portainer.StackOption{Prune: false},
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
	h.ComposeStackManager = testhelpers.NewComposeStackManager()

	payload := updateComposeStackPayload{
		StackFileContent: "services:\n  web:\n    image: alpine:2\n",
		Env:              []portainer.Pair{{Name: "Z", Value: "9"}},
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
	assert.Zero(t, updated.WorkflowID)
	assert.Nil(t, updated.AutoUpdate)
	assert.True(t, updated.FromAppTemplate)
	require.NotNil(t, updated.Option)
	assert.True(t, updated.Option.Prune)
	assert.Equal(t, []portainer.Pair{{Name: "Z", Value: "9"}}, updated.Env)
}

func TestREQ_STK_04_UpdateCompose_InvalidStackID_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	body, _ := json.Marshal(updateComposeStackPayload{StackFileContent: "services: {}\n"})
	req := mockCreateStackRequestWithSecurityContext(http.MethodPut, "/stacks/abc?endpointId=1", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_04_UpdateCompose_MissingEndpoint_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "s", Type: portainer.DockerComposeStack, EndpointID: 1, EntryPoint: "docker-compose.yml",
		Status: portainer.StackStatusActive,
	}))
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.ComposeStackManager = testhelpers.NewComposeStackManager()
	body, _ := json.Marshal(updateComposeStackPayload{StackFileContent: "services: {}\n"})
	req := mockCreateStackRequestWithSecurityContext(http.MethodPut, "/stacks/1?endpointId=99", bytes.NewReader(body))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_04_UpdateCompose_ManageDisabled_NonAdmin_ReturnsForbidden(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	fileService, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	_, err = mockCreateUser(store)
	require.NoError(t, err)
	std := &portainer.User{ID: 2, Username: "std", Role: portainer.StandardUserRole}
	require.NoError(t, store.User().Create(std))
	endpoint := &portainer.Endpoint{
		ID: 1, Name: "docker", Type: portainer.DockerEnvironment,
		SecuritySettings: portainer.EndpointSecuritySettings{AllowStackManagementForRegularUsers: false},
	}
	require.NoError(t, store.Endpoint().Create(endpoint))
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "s", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID,
		EntryPoint: "docker-compose.yml", ProjectPath: fileService.GetDatastorePath() + "/compose/1",
		Status: portainer.StackStatusActive,
	}))
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	h.FileService = fileService
	h.ComposeStackManager = testhelpers.NewComposeStackManager()

	body, _ := json.Marshal(updateComposeStackPayload{StackFileContent: "services: {}\n"})
	req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/stacks/1?endpointId=%d", endpoint.ID), bytes.NewReader(body))
	ctx := securityStoreNonAdmin(req, std)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req.WithContext(ctx))
	assert.Equal(t, http.StatusForbidden, w.Code)
}
