package containers

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/docker/consts"
	"github.com/portainer/portainer/api/http/middlewares"
	"github.com/portainer/portainer/api/internal/authorization"
	"github.com/portainer/portainer/api/internal/testhelpers"

	"github.com/docker/docker/api/types"
	dockercontainer "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type recreateDockerFixture struct {
	oldID      string
	newID      string
	name       string
	image      string
	labels     map[string]string
	networks   map[string]*network.EndpointSettings
	failAt     string
	apiVersion string
	mu         sync.Mutex
	calls      []string
}

func (fx *recreateDockerFixture) record(op string) {
	fx.mu.Lock()
	defer fx.mu.Unlock()
	fx.calls = append(fx.calls, op)
}

func (fx *recreateDockerFixture) inspectBody(id string) types.ContainerJSON {
	labels := fx.labels
	if labels == nil {
		labels = map[string]string{}
	}
	return types.ContainerJSON{
		ContainerJSONBase: &dockercontainer.ContainerJSONBase{
			ID:         id,
			Name:       fx.name,
			HostConfig: &dockercontainer.HostConfig{},
		},
		Config: &dockercontainer.Config{Image: fx.image, Labels: labels},
		NetworkSettings: &dockercontainer.NetworkSettings{
			Networks: fx.networks,
		},
	}
}

func newRecreateDockerServer(t *testing.T, fx *recreateDockerFixture) *httptest.Server {
	t.Helper()

	if fx.oldID == "" {
		fx.oldID = "old-ctr"
	}
	if fx.newID == "" {
		fx.newID = "new-ctr"
	}
	if fx.name == "" {
		fx.name = "/web"
	}
	if fx.image == "" {
		fx.image = "nginx:latest"
	}
	if fx.networks == nil {
		fx.networks = map[string]*network.EndpointSettings{
			"bridge": {NetworkID: "net-bridge", EndpointID: "ep-1", MacAddress: "02:42:ac:11:00:02"},
		}
	}
	if fx.apiVersion == "" {
		fx.apiVersion = "1.43"
	}

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		switch {
		case path == "/_ping" || strings.HasSuffix(path, "/_ping"):
			fx.record("ping")
			w.Header().Set("API-Version", fx.apiVersion)
			_, _ = io.WriteString(w, "OK")

		case strings.Contains(path, "/containers/") && strings.HasSuffix(path, "/json"):
			id := containerIDFromPath(path)
			fx.record("inspect:" + id)
			if fx.failAt == "inspect" && id == fx.oldID {
				http.Error(w, `{"message":"no such container"}`, http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(fx.inspectBody(id))

		case strings.Contains(path, "/containers/") && strings.HasSuffix(path, "/stop"):
			fx.record("stop")
			if fx.failAt == "stop" {
				http.Error(w, `{"message":"stop failed"}`, http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusNoContent)

		case strings.Contains(path, "/containers/") && strings.Contains(path, "/rename"):
			fx.record("rename")
			w.WriteHeader(http.StatusNoContent)

		case strings.Contains(path, "/networks/") && strings.HasSuffix(path, "/disconnect"):
			fx.record("disconnect")
			w.WriteHeader(http.StatusOK)

		case strings.HasSuffix(path, "/containers/create"):
			fx.record("create")
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(dockercontainer.CreateResponse{ID: fx.newID})

		case strings.Contains(path, "/networks/") && strings.HasSuffix(path, "/connect"):
			fx.record("connect")
			w.WriteHeader(http.StatusOK)

		case strings.Contains(path, "/containers/") && strings.HasSuffix(path, "/start"):
			fx.record("start")
			w.WriteHeader(http.StatusNoContent)

		case r.Method == http.MethodDelete && strings.Contains(path, "/containers/"):
			fx.record("remove")
			w.WriteHeader(http.StatusNoContent)

		case strings.Contains(path, "/images/create"):
			fx.record("pull")
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"status":"Pulling"}`+"\n")

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func containerIDFromPath(path string) string {
	parts := strings.Split(path, "/")
	for i, p := range parts {
		if p == "containers" && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	return ""
}

func postRecreate(t *testing.T, root http.Handler, containerID string, payload any, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()

	var body io.Reader
	switch v := payload.(type) {
	case nil:
		body = bytes.NewReader(nil)
	case []byte:
		body = bytes.NewReader(v)
	case string:
		body = strings.NewReader(v)
	default:
		b, err := json.Marshal(v)
		require.NoError(t, err)
		body = bytes.NewReader(b)
	}

	req := httptest.NewRequest(http.MethodPost, "/docker/1/containers/"+containerID+"/recreate", body)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rr := httptest.NewRecorder()
	root.ServeHTTP(rr, req)
	return rr
}

// recreateDirectRouter mounts recreate with WithEndpoint only (no CheckEndpointAuthorization),
// so the handler body's own AuthorizedEndpointOperation can be exercised.
func recreateDirectRouter(t *testing.T, h *Handler, store *datastore.Store) *mux.Router {
	t.Helper()
	root := mux.NewRouter()
	sub := root.PathPrefix("/docker/{id}").Subrouter()
	sub.Use(middlewares.WithEndpoint(store.Endpoint(), "id"))
	sub.HandleFunc("/containers/{containerId}/recreate", func(w http.ResponseWriter, r *http.Request) {
		if herr := h.recreate(w, r); herr != nil {
			w.WriteHeader(herr.StatusCode)
			_, _ = io.WriteString(w, herr.Message)
		}
	}).Methods(http.MethodPost)
	return root
}

func TestREQ_CTR_06_Recreate_SuccessWithoutWebhookOrResourceControl(t *testing.T) {
	t.Parallel()

	fx := &recreateDockerFixture{
		labels: map[string]string{
			consts.ComposeStackNameLabel: "web-stack",
			consts.SwarmServiceIDLabel:   "svc-1",
		},
	}
	srv := newRecreateDockerServer(t, fx)
	t.Cleanup(srv.Close)

	root, _, _, _ := newHandlerUnderTest(t, nil, srv.URL, 0)
	rr := postRecreate(t, root, fx.oldID, RecreatePayload{PullImage: false}, map[string]string{
		portainer.PortainerAgentTargetHeader: "node-a",
	})

	require.Equal(t, http.StatusOK, rr.Code)
	var got types.ContainerJSON
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	assert.Equal(t, fx.newID, got.ID)

	// Let the background EvictImageStatus goroutine run so those statements count.
	time.Sleep(50 * time.Millisecond)
}

func TestREQ_CTR_06_Recreate_PullImageUpdatesWebhookAndResourceControl(t *testing.T) {
	t.Parallel()

	fx := &recreateDockerFixture{}
	srv := newRecreateDockerServer(t, fx)
	t.Cleanup(srv.Close)

	root, _, store, endpoint := newHandlerUnderTest(t, nil, srv.URL, 0)

	webhook := &portainer.Webhook{
		Token:       "tok-old",
		ResourceID:  fx.oldID,
		EndpointID:  endpoint.ID,
		WebhookType: portainer.ServiceWebhook,
	}
	require.NoError(t, store.Webhook().Create(webhook))

	rc := authorization.NewPublicResourceControl(fx.oldID, portainer.ContainerResourceControl)
	require.NoError(t, store.ResourceControl().Create(rc))

	rr := postRecreate(t, root, fx.oldID, RecreatePayload{PullImage: true}, nil)
	require.Equal(t, http.StatusOK, rr.Code)

	updated, err := store.Webhook().WebhookByResourceID(fx.newID)
	require.NoError(t, err)
	assert.Equal(t, fx.newID, updated.ResourceID)

	controls, err := store.ResourceControl().ReadAll()
	require.NoError(t, err)
	foundNew := false
	for _, c := range controls {
		if c.ResourceID == fx.newID && c.Type == portainer.ContainerResourceControl {
			foundNew = true
			break
		}
	}
	assert.True(t, foundNew, "expected resource control retargeted to new container id")

	time.Sleep(50 * time.Millisecond)
}

func TestREQ_CTR_06_Recreate_ServiceError_Returns500(t *testing.T) {
	t.Parallel()

	fx := &recreateDockerFixture{failAt: "inspect"}
	srv := newRecreateDockerServer(t, fx)
	t.Cleanup(srv.Close)

	root, _, _, _ := newHandlerUnderTest(t, nil, srv.URL, 0)
	rr := postRecreate(t, root, fx.oldID, RecreatePayload{}, nil)

	assert.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestREQ_CTR_06_Recreate_InvalidPayload_Returns400(t *testing.T) {
	t.Parallel()

	root, _, _, _ := newHandlerUnderTest(t, nil, "", 0)
	rr := postRecreate(t, root, "ctr-1", []byte(`{not-json`), nil)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestREQ_CTR_06_Recreate_MiddlewarePermissionDenied_Returns403(t *testing.T) {
	t.Parallel()

	fx := &recreateDockerFixture{}
	srv := newRecreateDockerServer(t, fx)
	t.Cleanup(srv.Close)

	root, _, _, _ := newHandlerUnderTest(t, denyBouncer{BouncerService: testhelpers.NewTestRequestBouncer()}, srv.URL, 0)
	rr := postRecreate(t, root, fx.oldID, RecreatePayload{}, nil)

	assert.Equal(t, http.StatusForbidden, rr.Code)
}

func TestREQ_CTR_06_Recreate_HandlerAuthDenied_Returns403(t *testing.T) {
	t.Parallel()

	fx := &recreateDockerFixture{}
	srv := newRecreateDockerServer(t, fx)
	t.Cleanup(srv.Close)

	_, h, store, _ := newHandlerUnderTest(t, testhelpers.NewTestRequestBouncer(), srv.URL, 0)
	h.bouncer = denyBouncer{BouncerService: testhelpers.NewTestRequestBouncer()}

	root := recreateDirectRouter(t, h, store)
	rr := postRecreate(t, root, fx.oldID, RecreatePayload{}, nil)
	assert.Equal(t, http.StatusForbidden, rr.Code)
}

func TestREQ_CTR_06_Recreate_MissingEndpointContext_Returns404(t *testing.T) {
	t.Parallel()

	_, h, _, _ := newHandlerUnderTest(t, nil, "", 0)

	body, err := json.Marshal(RecreatePayload{})
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/recreate", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"containerId": "ctr-1"})
	rr := httptest.NewRecorder()

	herr := h.recreate(rr, req)
	require.NotNil(t, herr)
	assert.Equal(t, http.StatusNotFound, herr.StatusCode)
}

func TestREQ_CTR_06_Recreate_InvalidContainerID_Returns400(t *testing.T) {
	t.Parallel()

	_, h, _, _ := newHandlerUnderTest(t, nil, "", 0)

	req := httptest.NewRequest(http.MethodPost, "/recreate", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	herr := h.recreate(rr, req)
	require.NotNil(t, herr)
	assert.Equal(t, http.StatusBadRequest, herr.StatusCode)
}

func TestREQ_CTR_06_RecreatePayload_ValidateAlwaysNil(t *testing.T) {
	t.Parallel()

	var p RecreatePayload
	require.NoError(t, p.Validate(nil))
	p.PullImage = true
	require.NoError(t, p.Validate(httptest.NewRequest(http.MethodPost, "/", nil)))
}

func TestCreateResourceControl_NoExistingControl_IsNoop(t *testing.T) {
	t.Parallel()

	_, h, _, _ := newHandlerUnderTest(t, nil, "", 0)
	h.createResourceControl("missing-old", "new-1")

	controls, err := h.dataStore.ResourceControl().ReadAll()
	require.NoError(t, err)
	for _, c := range controls {
		assert.NotEqual(t, "new-1", c.ResourceID)
	}
}

func TestCreateResourceControl_CopiesExistingControlToNewID(t *testing.T) {
	t.Parallel()

	_, h, store, _ := newHandlerUnderTest(t, nil, "", 0)
	require.NoError(t, store.ResourceControl().Create(
		authorization.NewPublicResourceControl("old-rc", portainer.ContainerResourceControl),
	))

	h.createResourceControl("old-rc", "new-rc")

	controls, err := store.ResourceControl().ReadAll()
	require.NoError(t, err)
	found := false
	for _, c := range controls {
		if c.ResourceID == "new-rc" {
			found = true
			assert.True(t, c.Public)
		}
	}
	assert.True(t, found)
}

func TestUpdateWebhook_MissingWebhook_IsNoop(t *testing.T) {
	t.Parallel()

	_, h, _, _ := newHandlerUnderTest(t, nil, "", 0)
	h.updateWebhook("no-such-container", "new-id")
}

func TestUpdateWebhook_RetargetsExistingWebhook(t *testing.T) {
	t.Parallel()

	_, h, store, endpoint := newHandlerUnderTest(t, nil, "", 0)
	require.NoError(t, store.Webhook().Create(&portainer.Webhook{
		Token:       "tok",
		ResourceID:  "old-wh",
		EndpointID:  endpoint.ID,
		WebhookType: portainer.ServiceWebhook,
	}))

	h.updateWebhook("old-wh", "new-wh")

	got, err := store.Webhook().WebhookByResourceID("new-wh")
	require.NoError(t, err)
	assert.Equal(t, "new-wh", got.ResourceID)
}

// storeOverride wraps a real DataStore but can replace ResourceControl / Webhook services
// so datastore failure arms in createResourceControl / updateWebhook are reachable.
type storeOverride struct {
	dataservices.DataStore
	rc dataservices.ResourceControlService
	wh dataservices.WebhookService
}

func (s storeOverride) ResourceControl() dataservices.ResourceControlService {
	if s.rc != nil {
		return s.rc
	}
	return s.DataStore.ResourceControl()
}

func (s storeOverride) Webhook() dataservices.WebhookService {
	if s.wh != nil {
		return s.wh
	}
	return s.DataStore.Webhook()
}

type failReadAllRC struct {
	dataservices.ResourceControlService
}

func (failReadAllRC) ReadAll(_ ...func(portainer.ResourceControl) bool) ([]portainer.ResourceControl, error) {
	return nil, errors.New("resource control read failed")
}

type failCreateRC struct {
	dataservices.ResourceControlService
	items []portainer.ResourceControl
}

func (f failCreateRC) ReadAll(_ ...func(portainer.ResourceControl) bool) ([]portainer.ResourceControl, error) {
	return f.items, nil
}

func (failCreateRC) Create(_ *portainer.ResourceControl) error {
	return errors.New("resource control create failed")
}

type failUpdateWebhook struct {
	dataservices.WebhookService
	webhook *portainer.Webhook
}

func (f failUpdateWebhook) WebhookByResourceID(resourceID string) (*portainer.Webhook, error) {
	if f.webhook != nil && f.webhook.ResourceID == resourceID {
		cp := *f.webhook
		return &cp, nil
	}
	return nil, errors.New("not found")
}

func (failUpdateWebhook) Update(_ portainer.WebhookID, _ *portainer.Webhook) error {
	return errors.New("webhook update failed")
}

func TestCreateResourceControl_ReadAllError_LogsAndReturns(t *testing.T) {
	t.Parallel()

	_, h, store, _ := newHandlerUnderTest(t, nil, "", 0)
	h.dataStore = storeOverride{DataStore: store, rc: failReadAllRC{}}
	h.createResourceControl("old", "new")
}

func TestCreateResourceControl_CreateError_LogsAndReturns(t *testing.T) {
	t.Parallel()

	_, h, store, _ := newHandlerUnderTest(t, nil, "", 0)
	existing := authorization.NewPublicResourceControl("old-fail", portainer.ContainerResourceControl)
	h.dataStore = storeOverride{
		DataStore: store,
		rc: failCreateRC{items: []portainer.ResourceControl{*existing}},
	}
	h.createResourceControl("old-fail", "new-fail")
}

func TestUpdateWebhook_UpdateError_LogsAndReturns(t *testing.T) {
	t.Parallel()

	_, h, store, _ := newHandlerUnderTest(t, nil, "", 0)
	h.dataStore = storeOverride{
		DataStore: store,
		wh: failUpdateWebhook{webhook: &portainer.Webhook{
			ID:         9,
			Token:      "t",
			ResourceID: "old-upd",
			WebhookType: portainer.ServiceWebhook,
		}},
	}
	h.updateWebhook("old-upd", "new-upd")
}
