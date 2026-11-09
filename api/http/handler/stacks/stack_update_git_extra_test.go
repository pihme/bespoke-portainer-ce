package stacks

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices/source"
	"github.com/portainer/portainer/api/datastore"
	gittypes "github.com/portainer/portainer/api/git/types"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func withToken(req *http.Request) *http.Request {
	return req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
		ID: 1, Username: "testUser", Role: portainer.AdministratorRole,
	}))
}

func TestREQ_STK_04_GitUpdatePayload_InvalidAutoUpdate_Rejected(t *testing.T) {
	t.Parallel()
	payload := &stackGitUpdatePayload{
		AutoUpdate: &portainer.AutoUpdateSettings{Interval: "1s"},
	}
	err := payload.Validate(nil)
	require.Error(t, err)
}

func TestREQ_STK_04_GitUpdatePayload_NilAutoUpdate_OK(t *testing.T) {
	t.Parallel()
	payload := &stackGitUpdatePayload{}
	require.NoError(t, payload.Validate(nil))
}

func TestREQ_STK_03_GitRedeploy_MissingStack_ReturnsNotFound(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	_, err = mockCreateEndpoint(store)
	require.NoError(t, err)

	body, _ := json.Marshal(stackGitRedeployPayload{})
	req := withToken(mockCreateStackRequestWithSecurityContext(http.MethodPut, "/stacks/99/git/redeploy?endpointId=1", bytes.NewReader(body)))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestREQ_STK_03_GitRedeploy_NonGitStack_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 1, Name: "plain", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID, WorkflowID: 0,
	}))

	body, _ := json.Marshal(stackGitRedeployPayload{})
	req := withToken(mockCreateStackRequestWithSecurityContext(http.MethodPut, "/stacks/1/git/redeploy?endpointId=1", bytes.NewReader(body)))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_03_GitRedeploy_DeployingGitStack_ReturnsConflict(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	h := NewHandler(testhelpers.NewTestRequestBouncer(), nil)
	h.DataStore = store
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	admin := source.InsecureNewAdminContext()
	src := &portainer.Source{
		Type: portainer.SourceTypeGit,
		Git:  &gittypes.GitSource{URL: "https://example.com/repo.git"},
	}
	require.NoError(t, store.Source().Create(admin, src))

	stackID := portainer.StackID(1)
	wf := &portainer.Workflow{
		Artifacts: []portainer.Artifact{{
			StackID: stackID,
			Files:   []portainer.ArtifactFile{{SourceID: src.ID, Ref: "refs/heads/main", Hash: "abc"}},
		}},
	}
	require.NoError(t, store.Workflow().Create(wf))
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: stackID, Name: "busy", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID,
		WorkflowID: wf.ID, Status: portainer.StackStatusDeploying,
	}))

	body, _ := json.Marshal(stackGitRedeployPayload{})
	req := withToken(mockCreateStackRequestWithSecurityContext(http.MethodPut, "/stacks/1/git/redeploy?endpointId=1", bytes.NewReader(body)))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusConflict, w.Code)
}
