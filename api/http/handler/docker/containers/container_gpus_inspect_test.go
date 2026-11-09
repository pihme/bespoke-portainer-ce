package containers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	portainer "github.com/portainer/portainer/api"

	"github.com/docker/docker/api/types"
	dockercontainer "github.com/docker/docker/api/types/container"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type gpuInspectFixture struct {
	containerID string
	hostConfig  *dockercontainer.HostConfig
	missing     bool
	apiVersion  string
}

func newGPUInspectServer(t *testing.T, fx *gpuInspectFixture) *httptest.Server {
	t.Helper()

	if fx.containerID == "" {
		fx.containerID = "ctr-gpu"
	}
	if fx.apiVersion == "" {
		fx.apiVersion = "1.43"
	}

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case path == "/_ping" || strings.HasSuffix(path, "/_ping"):
			w.Header().Set("API-Version", fx.apiVersion)
			_, _ = io.WriteString(w, "OK")

		case strings.Contains(path, "/containers/") && strings.HasSuffix(path, "/json"):
			if fx.missing {
				http.Error(w, `{"message":"no such container"}`, http.StatusNotFound)
				return
			}
			body := types.ContainerJSON{
				ContainerJSONBase: &dockercontainer.ContainerJSONBase{
					ID:         fx.containerID,
					Name:       "/gpu-box",
					HostConfig: fx.hostConfig,
				},
				Config: &dockercontainer.Config{Image: "nvidia/cuda:latest"},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(body)

		default:
			http.NotFound(w, r)
		}
	}))
}

func getGPUs(t *testing.T, root http.Handler, containerID string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/docker/1/containers/"+containerID+"/gpus", nil)
	rr := httptest.NewRecorder()
	root.ServeHTTP(rr, req)
	return rr
}

func TestContainerGpusInspect_NoDeviceRequests_ReturnsNone(t *testing.T) {
	t.Parallel()

	fx := &gpuInspectFixture{hostConfig: &dockercontainer.HostConfig{}}
	srv := newGPUInspectServer(t, fx)
	t.Cleanup(srv.Close)

	root, _, _, _ := newHandlerUnderTest(t, nil, srv.URL, 0)
	rr := getGPUs(t, root, fx.containerID)

	require.Equal(t, http.StatusOK, rr.Code)
	var got containerGpusResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	assert.Equal(t, "none", got.Gpus)
}

func TestContainerGpusInspect_NvidiaDriverAll_ReturnsAll(t *testing.T) {
	t.Parallel()

	fx := &gpuInspectFixture{
		hostConfig: &dockercontainer.HostConfig{
			Resources: dockercontainer.Resources{
				DeviceRequests: []dockercontainer.DeviceRequest{
					{Driver: "nvidia", Count: -1},
				},
			},
		},
	}
	srv := newGPUInspectServer(t, fx)
	t.Cleanup(srv.Close)

	root, _, _, _ := newHandlerUnderTest(t, nil, srv.URL, 0)
	rr := getGPUs(t, root, fx.containerID)

	require.Equal(t, http.StatusOK, rr.Code)
	var got containerGpusResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	assert.Equal(t, "all", got.Gpus)
}

func TestContainerGpusInspect_GPUCapabilitySpecificIDs(t *testing.T) {
	t.Parallel()

	fx := &gpuInspectFixture{
		hostConfig: &dockercontainer.HostConfig{
			Resources: dockercontainer.Resources{
				DeviceRequests: []dockercontainer.DeviceRequest{
					{Capabilities: [][]string{{"gpu"}}, Count: 2, DeviceIDs: []string{"0", "1"}},
				},
			},
		},
	}
	srv := newGPUInspectServer(t, fx)
	t.Cleanup(srv.Close)

	root, _, _, _ := newHandlerUnderTest(t, nil, srv.URL, 0)
	rr := getGPUs(t, root, fx.containerID)

	require.Equal(t, http.StatusOK, rr.Code)
	var got containerGpusResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	assert.Equal(t, "id:0,1", got.Gpus)
}

func TestContainerGpusInspect_SkipsEmptyCapabilitiesThenMatchesGPU(t *testing.T) {
	t.Parallel()

	fx := &gpuInspectFixture{
		hostConfig: &dockercontainer.HostConfig{
			Resources: dockercontainer.Resources{
				DeviceRequests: []dockercontainer.DeviceRequest{
					{Driver: "other", Capabilities: nil},
					{Driver: "other", Capabilities: [][]string{{}}},
					{Capabilities: [][]string{{"gpu"}}, Count: -1},
				},
			},
		},
	}
	srv := newGPUInspectServer(t, fx)
	t.Cleanup(srv.Close)

	root, _, _, _ := newHandlerUnderTest(t, nil, srv.URL, 0)
	rr := getGPUs(t, root, fx.containerID)

	require.Equal(t, http.StatusOK, rr.Code)
	var got containerGpusResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	assert.Equal(t, "all", got.Gpus)
}

func TestContainerGpusInspect_NilHostConfig_Returns404(t *testing.T) {
	t.Parallel()

	fx := &gpuInspectFixture{hostConfig: nil}
	srv := newGPUInspectServer(t, fx)
	t.Cleanup(srv.Close)

	root, _, _, _ := newHandlerUnderTest(t, nil, srv.URL, 0)
	rr := getGPUs(t, root, fx.containerID)

	assert.Equal(t, http.StatusNotFound, rr.Code)
}

func TestContainerGpusInspect_ContainerMissing_Returns404(t *testing.T) {
	t.Parallel()

	fx := &gpuInspectFixture{missing: true, hostConfig: &dockercontainer.HostConfig{}}
	srv := newGPUInspectServer(t, fx)
	t.Cleanup(srv.Close)

	root, _, _, _ := newHandlerUnderTest(t, nil, srv.URL, 0)
	rr := getGPUs(t, root, fx.containerID)

	assert.Equal(t, http.StatusNotFound, rr.Code)
}

func TestContainerGpusInspect_CreateClientError_Returns500(t *testing.T) {
	t.Parallel()

	// Azure environments are rejected by the docker client factory.
	root, _, _, _ := newHandlerUnderTest(t, nil, "https://example.invalid", portainer.AzureEnvironment)
	rr := getGPUs(t, root, "ctr-1")

	assert.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestContainerGpusInspect_MissingEndpointContext_Returns404(t *testing.T) {
	t.Parallel()

	_, h, _, _ := newHandlerUnderTest(t, nil, "", 0)

	req := httptest.NewRequest(http.MethodGet, "/docker/1/containers/ctr-1/gpus", nil)
	req = mux.SetURLVars(req, map[string]string{"containerId": "ctr-1"})
	rr := httptest.NewRecorder()

	herr := h.containerGpusInspect(rr, req)
	require.NotNil(t, herr)
	assert.Equal(t, http.StatusNotFound, herr.StatusCode)
}

func TestContainerGpusInspect_InvalidContainerID_Returns400(t *testing.T) {
	t.Parallel()

	_, h, _, _ := newHandlerUnderTest(t, nil, "", 0)

	req := httptest.NewRequest(http.MethodGet, "/gpus", nil)
	rr := httptest.NewRecorder()

	herr := h.containerGpusInspect(rr, req)
	require.NotNil(t, herr)
	assert.Equal(t, http.StatusBadRequest, herr.StatusCode)
}
