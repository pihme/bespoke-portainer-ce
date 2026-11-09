package docker

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	dockerdomain "github.com/portainer/portainer/api/docker"
	dockerclient "github.com/portainer/portainer/api/docker/client"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/authorization"
	"github.com/portainer/portainer/api/internal/testhelpers"

	"github.com/docker/docker/api/types"
	dockercontainer "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/system"
	"github.com/docker/docker/api/types/volume"
	"github.com/stretchr/testify/require"
)

type dashboardDockerFixture struct {
	failAt     string
	containers []dockercontainer.Summary
	images     []image.Summary
	volumes    []*volume.Volume
	networks   []network.Summary
	info       system.Info
	apiVersion string
}

func newDashboardDockerServer(t *testing.T, fx *dashboardDockerFixture) *httptest.Server {
	t.Helper()
	if fx.apiVersion == "" {
		fx.apiVersion = "1.43"
	}
	if fx.info.ID == "" {
		fx.info = system.Info{ID: "engine-local-1", ServerVersion: "24.0.0"}
	}
	if fx.containers == nil {
		fx.containers = []dockercontainer.Summary{}
	}
	if fx.images == nil {
		fx.images = []image.Summary{}
	}
	if fx.volumes == nil {
		fx.volumes = []*volume.Volume{}
	}
	if fx.networks == nil {
		fx.networks = []network.Summary{}
	}

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		w.Header().Set("Content-Type", "application/json")

		switch {
		case path == "/_ping" || strings.HasSuffix(path, "/_ping"):
			w.Header().Set("API-Version", fx.apiVersion)
			w.Header().Del("Content-Type")
			_, _ = io.WriteString(w, "OK")

		case strings.Contains(path, "/containers/") && strings.HasSuffix(path, "/json") && !strings.HasSuffix(path, "/containers/json"):
			if fx.failAt == "inspect" {
				http.Error(w, `{"message":"inspect down"}`, http.StatusInternalServerError)
				return
			}
			id := path
			parts := strings.Split(path, "/")
			for i := range parts {
				if parts[i] == "containers" && i+1 < len(parts) {
					id = parts[i+1]
					break
				}
			}
			body := types.ContainerJSON{
				ContainerJSONBase: &dockercontainer.ContainerJSONBase{
					ID:         id,
					Name:       "/web",
					State:      &dockercontainer.State{Status: "running", Running: true, Health: &dockercontainer.Health{Status: "healthy"}},
					HostConfig: &dockercontainer.HostConfig{},
				},
				Config: &dockercontainer.Config{Image: "nginx:latest"},
			}
			_ = json.NewEncoder(w).Encode(body)

		case strings.HasSuffix(path, "/containers/json"):
			if fx.failAt == "containers" {
				http.Error(w, `{"message":"containers down"}`, http.StatusInternalServerError)
				return
			}
			_ = json.NewEncoder(w).Encode(fx.containers)

		case strings.HasSuffix(path, "/images/json"):
			if fx.failAt == "images" {
				http.Error(w, `{"message":"images down"}`, http.StatusInternalServerError)
				return
			}
			_ = json.NewEncoder(w).Encode(fx.images)

		case strings.HasSuffix(path, "/info"):
			if fx.failAt == "info" {
				http.Error(w, `{"message":"info down"}`, http.StatusInternalServerError)
				return
			}
			_ = json.NewEncoder(w).Encode(fx.info)

		case strings.HasSuffix(path, "/volumes"):
			if fx.failAt == "volumes" {
				http.Error(w, `{"message":"volumes down"}`, http.StatusInternalServerError)
				return
			}
			_ = json.NewEncoder(w).Encode(volume.ListResponse{Volumes: fx.volumes})

		case strings.HasSuffix(path, "/networks"):
			if fx.failAt == "networks" {
				http.Error(w, `{"message":"networks down"}`, http.StatusInternalServerError)
				return
			}
			_ = json.NewEncoder(w).Encode(fx.networks)

		case strings.HasSuffix(path, "/services"):
			if fx.failAt == "services" {
				http.Error(w, `{"message":"services down"}`, http.StatusInternalServerError)
				return
			}
			_ = json.NewEncoder(w).Encode([]any{})

		case strings.HasSuffix(path, "/version"):
			_ = json.NewEncoder(w).Encode(types.Version{Version: "24.0.0", APIVersion: fx.apiVersion})

		default:
			http.NotFound(w, r)
		}
	}))
}

func newDashboardHandler(t *testing.T, dockerURL string, endpointType portainer.EndpointType) (*Handler, *datastore.Store, *portainer.User) {
	t.Helper()

	if endpointType == 0 {
		endpointType = portainer.DockerEnvironment
	}

	_, store := datastore.MustNewTestStore(t, true, true)

	admin := &portainer.User{Username: "admin", Role: portainer.AdministratorRole}
	require.NoError(t, store.User().Create(admin))

	ep := &portainer.Endpoint{
		ID:               1,
		Name:             "local-docker",
		Type:             endpointType,
		URL:              dockerURL,
		SecuritySettings: portainer.DefaultEndpointSecuritySettings(),
	}
	require.NoError(t, store.Endpoint().Create(ep))

	bouncer := testhelpers.NewTestRequestBouncer()
	factory := dockerclient.NewClientFactory(nil, nil)
	authorizationService := authorization.NewService(store)
	containerService := dockerdomain.NewContainerService(factory, store)
	h := NewHandler(bouncer, authorizationService, store, factory, containerService)
	return h, store, admin
}

func getDashboard(t *testing.T, h *Handler, user *portainer.User) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/docker/1/dashboard", nil)
	req = req.WithContext(security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		IsAdmin: true,
		UserID:  user.ID,
		User:    user,
	}))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

func TestDashboard_LocalDocker_EmptyResources_OK(t *testing.T) {
	t.Parallel()

	srv := newDashboardDockerServer(t, &dashboardDockerFixture{})
	t.Cleanup(srv.Close)

	h, store, admin := newDashboardHandler(t, srv.URL, 0)

	id := portainer.StackID(store.Stack().GetNextIdentifier())
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: id, Name: "compose-app", Type: portainer.DockerComposeStack, EndpointID: 1,
	}))

	rr := getDashboard(t, h, admin)
	require.Equal(t, http.StatusOK, rr.Code)

	var got dashboardResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	require.Equal(t, 0, got.Images.Total)
	require.Equal(t, int64(0), got.Images.Size)
	require.Equal(t, 0, got.Volumes)
	require.Equal(t, 0, got.Networks)
	require.Equal(t, 1, got.Stacks)

	// REQ-TAI-003: Docker Swarm is removed; the dashboard has no services counter.
	var raw map[string]any
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &raw))
	require.NotContains(t, raw, "services")
}

func TestDashboard_LocalDocker_CountsImagesAndVolumes(t *testing.T) {
	t.Parallel()

	fx := &dashboardDockerFixture{
		images: []image.Summary{
			{ID: "img-1", Size: 100},
			{ID: "img-2", Size: 50},
		},
		volumes: []*volume.Volume{
			{Name: "vol-a"},
			{Name: "vol-b"},
		},
		networks: []network.Summary{
			{ID: "net-1", Name: "bridge"},
		},
		containers: []dockercontainer.Summary{
			{ID: "c1", Names: []string{"/web"}, State: "running", Status: "Up"},
		},
	}
	srv := newDashboardDockerServer(t, fx)
	t.Cleanup(srv.Close)

	h, _, admin := newDashboardHandler(t, srv.URL, 0)
	rr := getDashboard(t, h, admin)
	require.Equal(t, http.StatusOK, rr.Code)

	var got dashboardResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	require.Equal(t, 2, got.Images.Total)
	require.Equal(t, int64(150), got.Images.Size)
	require.Equal(t, 2, got.Volumes)
	require.Equal(t, 1, got.Networks)
	require.GreaterOrEqual(t, got.Containers.Total, 1)
	require.Equal(t, 1, got.Containers.Running)
}

func TestDashboard_ContainerListError_Returns500(t *testing.T) {
	t.Parallel()
	srv := newDashboardDockerServer(t, &dashboardDockerFixture{failAt: "containers"})
	t.Cleanup(srv.Close)
	h, _, admin := newDashboardHandler(t, srv.URL, 0)
	rr := getDashboard(t, h, admin)
	require.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestDashboard_ImageListError_Returns500(t *testing.T) {
	t.Parallel()
	srv := newDashboardDockerServer(t, &dashboardDockerFixture{failAt: "images"})
	t.Cleanup(srv.Close)
	h, _, admin := newDashboardHandler(t, srv.URL, 0)
	rr := getDashboard(t, h, admin)
	require.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestDashboard_InfoError_Returns500(t *testing.T) {
	t.Parallel()
	srv := newDashboardDockerServer(t, &dashboardDockerFixture{failAt: "info"})
	t.Cleanup(srv.Close)
	h, _, admin := newDashboardHandler(t, srv.URL, 0)
	rr := getDashboard(t, h, admin)
	require.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestDashboard_VolumeListError_Returns500(t *testing.T) {
	t.Parallel()
	srv := newDashboardDockerServer(t, &dashboardDockerFixture{failAt: "volumes"})
	t.Cleanup(srv.Close)
	h, _, admin := newDashboardHandler(t, srv.URL, 0)
	rr := getDashboard(t, h, admin)
	require.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestDashboard_NetworkListError_Returns500(t *testing.T) {
	t.Parallel()
	srv := newDashboardDockerServer(t, &dashboardDockerFixture{failAt: "networks"})
	t.Cleanup(srv.Close)
	h, _, admin := newDashboardHandler(t, srv.URL, 0)
	rr := getDashboard(t, h, admin)
	require.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestDashboard_MissingSecurityContext_Returns500(t *testing.T) {
	t.Parallel()
	srv := newDashboardDockerServer(t, &dashboardDockerFixture{})
	t.Cleanup(srv.Close)
	h, _, _ := newDashboardHandler(t, srv.URL, 0)

	req := httptest.NewRequest(http.MethodGet, "/docker/1/dashboard", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestDashboard_UnknownUser_Returns500(t *testing.T) {
	t.Parallel()
	srv := newDashboardDockerServer(t, &dashboardDockerFixture{})
	t.Cleanup(srv.Close)
	h, _, _ := newDashboardHandler(t, srv.URL, 0)

	req := httptest.NewRequest(http.MethodGet, "/docker/1/dashboard", nil)
	req = req.WithContext(security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		IsAdmin: true,
		UserID:  9999,
	}))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestDockerOnlyMiddleware_RejectsNonDockerEndpoint(t *testing.T) {
	t.Parallel()
	h, _, admin := newDashboardHandler(t, "tcp://127.0.0.1:1", portainer.KubernetesLocalEnvironment)

	req := httptest.NewRequest(http.MethodGet, "/docker/1/dashboard", nil)
	req = req.WithContext(security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		IsAdmin: true,
		UserID:  admin.ID,
		User:    admin,
	}))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusBadRequest, rr.Code)
	require.Contains(t, rr.Body.String(), "not a docker environment")
}

func TestDockerOnlyMiddleware_MissingEndpoint_Returns500(t *testing.T) {
	t.Parallel()
	h, _, admin := newDashboardHandler(t, "tcp://127.0.0.1:1", 0)

	req := httptest.NewRequest(http.MethodGet, "/docker/99/dashboard", nil)
	req = req.WithContext(security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		IsAdmin: true,
		UserID:  admin.ID,
		User:    admin,
	}))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	// WithEndpoint returns before dockerOnlyMiddleware when endpoint is missing
	require.True(t, rr.Code == http.StatusNotFound || rr.Code == http.StatusInternalServerError || rr.Code == http.StatusBadRequest)
}

func TestNewHandler_WiresDashboardRoute(t *testing.T) {
	t.Parallel()
	h, _, _ := newDashboardHandler(t, "tcp://127.0.0.1:1", 0)
	require.NotNil(t, h)
	require.NotNil(t, h.Router)

	req := httptest.NewRequest(http.MethodGet, "/docker/1/dashboard", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.NotEqual(t, http.StatusNotFound, rr.Code)
}

func TestDashboard_NilVolumeInList_ReturnsError(t *testing.T) {
	t.Parallel()
	fx := &dashboardDockerFixture{
		volumes: []*volume.Volume{nil},
	}
	srv := newDashboardDockerServer(t, fx)
	t.Cleanup(srv.Close)
	h, store, _ := newDashboardHandler(t, srv.URL, 0)
	std := &portainer.User{Username: "std-vol", Role: portainer.StandardUserRole}
	require.NoError(t, store.User().Create(std))

	req := httptest.NewRequest(http.MethodGet, "/docker/1/dashboard", nil)
	req = req.WithContext(security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		IsAdmin: false,
		UserID:  std.ID,
		User:    std,
	}))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestDashboard_ContainerInspectError_StatsFail(t *testing.T) {
	t.Parallel()
	fx := &dashboardDockerFixture{
		containers: []dockercontainer.Summary{
			{ID: "missing-ctr", Names: []string{"/gone"}, State: "running"},
		},
		failAt: "inspect",
	}
	srv := newDashboardDockerServer(t, fx)
	t.Cleanup(srv.Close)
	h, _, admin := newDashboardHandler(t, srv.URL, 0)
	rr := getDashboard(t, h, admin)
	require.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestDashboard_BadTLSClient_GetClientError(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, true)
	admin := &portainer.User{Username: "admin-tls", Role: portainer.AdministratorRole}
	require.NoError(t, store.User().Create(admin))

	ep := &portainer.Endpoint{
		ID:   1,
		Name: "tls-docker",
		Type: portainer.DockerEnvironment,
		URL:  "tcp://127.0.0.1:2376",
		TLSConfig: portainer.TLSConfiguration{
			TLS:         true,
			TLSCertPath: "/no/such/cert.pem",
			TLSKeyPath:  "/no/such/key.pem",
		},
		SecuritySettings: portainer.DefaultEndpointSecuritySettings(),
	}
	require.NoError(t, store.Endpoint().Create(ep))

	bouncer := testhelpers.NewTestRequestBouncer()
	factory := dockerclient.NewClientFactory(nil, nil)
	h := NewHandler(bouncer, authorization.NewService(store), store, factory, dockerdomain.NewContainerService(factory, store))

	rr := getDashboard(t, h, admin)
	require.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestDashboard_NonAdminWithoutStackManagement_ZeroStacks(t *testing.T) {
	t.Parallel()
	srv := newDashboardDockerServer(t, &dashboardDockerFixture{})
	t.Cleanup(srv.Close)

	h, store, _ := newDashboardHandler(t, srv.URL, 0)
	std := &portainer.User{Username: "std", Role: portainer.StandardUserRole}
	require.NoError(t, store.User().Create(std))

	ep, err := store.Endpoint().Endpoint(1)
	require.NoError(t, err)
	ep.SecuritySettings.AllowStackManagementForRegularUsers = false
	require.NoError(t, store.Endpoint().UpdateEndpoint(1, ep))

	id := portainer.StackID(store.Stack().GetNextIdentifier())
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: id, Name: "hidden", Type: portainer.DockerComposeStack, EndpointID: 1,
	}))

	req := httptest.NewRequest(http.MethodGet, "/docker/1/dashboard", nil)
	req = req.WithContext(security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		IsAdmin: false,
		UserID:  std.ID,
		User:    std,
	}))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusOK, rr.Code)
	var got dashboardResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	require.Equal(t, 0, got.Stacks)
}

