package docker

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	portainer "github.com/portainer/portainer/api"
	dockerclient "github.com/portainer/portainer/api/docker/client"

	"github.com/docker/docker/api/types"
	dockercontainer "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/require"
)

func TestREQ_CTR_06_NewContainerService(t *testing.T) {
	t.Parallel()

	factory := dockerclient.NewClientFactory(nil, nil)
	svc := NewContainerService(factory, nil)
	require.NotNil(t, svc)
	require.Same(t, factory, svc.factory)
	require.Nil(t, svc.dataStore)
}

func TestREQ_CTR_06_Recreate_CreateClientError(t *testing.T) {
	t.Parallel()

	svc := NewContainerService(dockerclient.NewClientFactory(nil, nil), nil)
	_, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.AzureEnvironment,
		URL:  "https://example.invalid",
	}, "ctr-1", false, "", "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "create client error")
}

type recreateFixture struct {
	oldID      string
	newID      string
	name       string // Docker inspect Name, including leading slash
	image      string
	networks   map[string]*network.EndpointSettings
	failAt     string // "inspect" | "stop" | "rename" | "disconnect" | "create" | "connect" | "start" | "inspect-new" | "pull"
	failRename int    // fail the Nth rename call (1-based); 0 uses failAt=="rename" for every rename
	failStart  int    // fail the Nth start call (1-based); 0 uses failAt=="start" for every start
	failStop   int    // fail the Nth stop call (1-based)
	failRemove bool
	renameN    int
	startN     int
	stopN      int
	apiVersion string
	mu         sync.Mutex
	calls      []string
}

func (fx *recreateFixture) record(op string) {
	fx.mu.Lock()
	defer fx.mu.Unlock()
	fx.calls = append(fx.calls, op)
}

func (fx *recreateFixture) inspectBody(id string) types.ContainerJSON {
	name := fx.name
	image := fx.image
	if id == fx.newID {
		// Recreated container keeps the same name and config.
	}
	base := &dockercontainer.ContainerJSONBase{
		ID:         id,
		Name:       name,
		HostConfig: &dockercontainer.HostConfig{},
	}
	return types.ContainerJSON{
		ContainerJSONBase: base,
		Config:            &dockercontainer.Config{Image: image},
		NetworkSettings: &dockercontainer.NetworkSettings{
			Networks: fx.networks,
		},
	}
}

func newRecreateServer(t *testing.T, fx *recreateFixture) *httptest.Server {
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
			_, _ = w.Write([]byte("OK"))

		case strings.Contains(path, "/containers/") && strings.HasSuffix(path, "/json"):
			id := containerIDFromDockerPath(path)
			fx.record("inspect:" + id)
			if fx.failAt == "inspect" && id == fx.oldID {
				http.Error(w, `{"message":"no such container"}`, http.StatusNotFound)
				return
			}
			if fx.failAt == "inspect-new" && id == fx.newID {
				http.Error(w, `{"message":"inspect new failed"}`, http.StatusInternalServerError)
				return
			}
			body := fx.inspectBody(id)
			if id == fx.newID {
				body = fx.inspectBody(fx.newID)
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(body)

		case strings.Contains(path, "/containers/") && strings.HasSuffix(path, "/stop"):
			fx.record("stop")
			fx.mu.Lock()
			fx.stopN++
			n := fx.stopN
			fx.mu.Unlock()
			if fx.failAt == "stop" || (fx.failStop > 0 && n == fx.failStop) {
				http.Error(w, `{"message":"stop failed"}`, http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusNoContent)

		case strings.Contains(path, "/containers/") && strings.Contains(path, "/rename"):
			fx.record("rename")
			fx.mu.Lock()
			fx.renameN++
			n := fx.renameN
			fx.mu.Unlock()
			if fx.failAt == "rename" || (fx.failRename > 0 && n == fx.failRename) {
				http.Error(w, `{"message":"rename failed"}`, http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusNoContent)

		case strings.Contains(path, "/networks/") && strings.HasSuffix(path, "/disconnect"):
			fx.record("disconnect")
			if fx.failAt == "disconnect" {
				http.Error(w, `{"message":"disconnect failed"}`, http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)

		case strings.HasSuffix(path, "/containers/create"):
			fx.record("create")
			if fx.failAt == "create" {
				http.Error(w, `{"message":"create failed"}`, http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(dockercontainer.CreateResponse{ID: fx.newID})

		case strings.Contains(path, "/networks/") && strings.HasSuffix(path, "/connect"):
			fx.record("connect")
			if fx.failAt == "connect" {
				http.Error(w, `{"message":"connect failed"}`, http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)

		case strings.Contains(path, "/containers/") && strings.HasSuffix(path, "/start"):
			fx.record("start")
			fx.mu.Lock()
			fx.startN++
			n := fx.startN
			fx.mu.Unlock()
			if fx.failAt == "start" || (fx.failStart > 0 && n == fx.failStart) {
				http.Error(w, `{"message":"start failed"}`, http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusNoContent)

		case r.Method == http.MethodDelete && strings.Contains(path, "/containers/"):
			fx.record("remove")
			if fx.failRemove {
				http.Error(w, `{"message":"remove failed"}`, http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusNoContent)

		case strings.Contains(path, "/images/create"):
			fx.record("pull")
			if fx.failAt == "pull" {
				http.Error(w, `{"message":"pull failed"}`, http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"status":"Pulling"}`+"\n")

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func containerIDFromDockerPath(path string) string {
	parts := strings.Split(path, "/")
	for i, p := range parts {
		if p == "containers" && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	return ""
}

func TestREQ_CTR_06_Recreate_LocalContainerSuccess(t *testing.T) {
	t.Parallel()

	fx := &recreateFixture{}
	srv := newRecreateServer(t, fx)
	t.Cleanup(srv.Close)

	svc := NewContainerService(dockerclient.NewClientFactory(nil, nil), nil)
	got, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, fx.oldID, false, "", "")
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, fx.newID, got.ID)
	require.Equal(t, fx.name, got.Name)
}

func TestREQ_CTR_06_Recreate_WithImageTagAndSecondNetwork(t *testing.T) {
	t.Parallel()

	fx := &recreateFixture{
		image: "nginx:1.25",
		networks: map[string]*network.EndpointSettings{
			"bridge": {NetworkID: "net-bridge", EndpointID: "ep-1", MacAddress: "02:42:ac:11:00:02"},
			"appnet": {NetworkID: "net-app", EndpointID: "ep-2", MacAddress: "02:42:ac:11:00:03"},
		},
		apiVersion: "1.45", // no MAC clear on create
	}
	srv := newRecreateServer(t, fx)
	t.Cleanup(srv.Close)

	svc := NewContainerService(dockerclient.NewClientFactory(nil, nil), nil)
	got, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, fx.oldID, false, "1.26", "")
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, fx.newID, got.ID)

	fx.mu.Lock()
	defer fx.mu.Unlock()
	require.Contains(t, fx.calls, "disconnect")
	require.Contains(t, fx.calls, "connect")
	require.Contains(t, fx.calls, "create")
}

func TestREQ_CTR_06_Recreate_InspectError(t *testing.T) {
	t.Parallel()

	fx := &recreateFixture{failAt: "inspect"}
	srv := newRecreateServer(t, fx)
	t.Cleanup(srv.Close)

	svc := NewContainerService(dockerclient.NewClientFactory(nil, nil), nil)
	_, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, fx.oldID, false, "", "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "fetch container information error")
}

func TestREQ_CTR_06_Recreate_StopError(t *testing.T) {
	t.Parallel()

	fx := &recreateFixture{failAt: "stop"}
	srv := newRecreateServer(t, fx)
	t.Cleanup(srv.Close)

	svc := NewContainerService(dockerclient.NewClientFactory(nil, nil), nil)
	_, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, fx.oldID, false, "", "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "stop container error")
}

func TestREQ_CTR_06_Recreate_CreateErrorRestoresOldContainer(t *testing.T) {
	t.Parallel()

	fx := &recreateFixture{failAt: "create"}
	srv := newRecreateServer(t, fx)
	t.Cleanup(srv.Close)

	svc := NewContainerService(dockerclient.NewClientFactory(nil, nil), nil)
	_, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, fx.oldID, false, "", "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "create container error")

	fx.mu.Lock()
	defer fx.mu.Unlock()
	// restore path renames back and reconnects/starts the old container
	require.Contains(t, fx.calls, "rename")
	require.Contains(t, fx.calls, "connect")
	require.Contains(t, fx.calls, "start")
}

func TestREQ_CTR_06_Recreate_InvalidImageParse(t *testing.T) {
	t.Parallel()

	fx := &recreateFixture{image: "INVALID@@"}
	srv := newRecreateServer(t, fx)
	t.Cleanup(srv.Close)

	svc := NewContainerService(dockerclient.NewClientFactory(nil, nil), nil)
	_, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, fx.oldID, false, "", "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "parse image error")
}

func TestREQ_CTR_06_Recreate_ConnectExtraNetworkError(t *testing.T) {
	t.Parallel()

	fx := &recreateFixture{
		failAt: "connect",
		networks: map[string]*network.EndpointSettings{
			"bridge": {NetworkID: "net-bridge", EndpointID: "ep-1"},
			"appnet": {NetworkID: "net-app", EndpointID: "ep-2"},
		},
	}
	srv := newRecreateServer(t, fx)
	t.Cleanup(srv.Close)

	svc := NewContainerService(dockerclient.NewClientFactory(nil, nil), nil)
	_, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, fx.oldID, false, "", "")
	require.Error(t, err)
	// Either disconnect restore-connect or post-create connect can fail with this message.
	require.True(t,
		strings.Contains(err.Error(), "connect container network error") ||
			strings.Contains(err.Error(), "disconnect network from old container error") ||
			strings.Contains(err.Error(), "create container error"),
		"got: %v", err)
}

func TestREQ_CTR_06_Recreate_RenameError(t *testing.T) {
	t.Parallel()

	fx := &recreateFixture{failAt: "rename"}
	srv := newRecreateServer(t, fx)
	t.Cleanup(srv.Close)

	svc := NewContainerService(dockerclient.NewClientFactory(nil, nil), nil)
	_, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, fx.oldID, false, "", "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "rename container error")
}

func TestREQ_CTR_06_Recreate_DisconnectError(t *testing.T) {
	t.Parallel()

	fx := &recreateFixture{failAt: "disconnect"}
	srv := newRecreateServer(t, fx)
	t.Cleanup(srv.Close)

	svc := NewContainerService(dockerclient.NewClientFactory(nil, nil), nil)
	_, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, fx.oldID, false, "", "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "disconnect network from old container error")
}

func TestREQ_CTR_06_Recreate_StartNewContainerError(t *testing.T) {
	t.Parallel()

	fx := &recreateFixture{failAt: "start"}
	srv := newRecreateServer(t, fx)
	t.Cleanup(srv.Close)

	svc := NewContainerService(dockerclient.NewClientFactory(nil, nil), nil)
	_, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, fx.oldID, false, "", "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "start container error")
}

func TestREQ_CTR_06_Recreate_InspectNewContainerError(t *testing.T) {
	t.Parallel()

	fx := &recreateFixture{failAt: "inspect-new"}
	srv := newRecreateServer(t, fx)
	t.Cleanup(srv.Close)

	svc := NewContainerService(dockerclient.NewClientFactory(nil, nil), nil)
	_, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, fx.oldID, false, "", "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "fetch container information error")
}

func TestREQ_CTR_06_Recreate_InvalidImageTag(t *testing.T) {
	t.Parallel()

	fx := &recreateFixture{image: "nginx:latest"}
	srv := newRecreateServer(t, fx)
	t.Cleanup(srv.Close)

	svc := NewContainerService(dockerclient.NewClientFactory(nil, nil), nil)
	_, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, fx.oldID, false, "BAD TAG!!", "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "set image tag error")
}

func TestREQ_CTR_06_Recreate_RestoreWarnPaths(t *testing.T) {
	t.Parallel()

	fx := &recreateFixture{
		failAt:     "create",
		failRename: 2,
		failStart:  1,
	}
	srv := newRecreateServer(t, fx)
	t.Cleanup(srv.Close)

	svc := NewContainerService(dockerclient.NewClientFactory(nil, nil), nil)
	_, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, fx.oldID, false, "", "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "create container error")
}

func TestREQ_CTR_06_Recreate_CleanupNewContainerWarnPaths(t *testing.T) {
	t.Parallel()

	fx := &recreateFixture{
		failAt:     "connect",
		failStop:   2,
		failRemove: true,
		networks: map[string]*network.EndpointSettings{
			"bridge": {NetworkID: "net-bridge", EndpointID: "ep-1"},
			"appnet": {NetworkID: "net-app", EndpointID: "ep-2"},
		},
	}
	srv := newRecreateServer(t, fx)
	t.Cleanup(srv.Close)

	svc := NewContainerService(dockerclient.NewClientFactory(nil, nil), nil)
	_, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, fx.oldID, false, "", "")
	require.Error(t, err)
}
