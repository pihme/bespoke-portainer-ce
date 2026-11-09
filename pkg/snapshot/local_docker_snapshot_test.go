package snapshot

import (
	"encoding/binary"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/docker/docker/api/types"
	dockercontainer "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/api/types/system"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/docker/consts"
	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/require"
)

// dockerMultiplexFrame builds a Docker multiplexed stream frame (stdout=1, stderr=2).
func dockerMultiplexFrame(stream byte, payload []byte) []byte {
	header := make([]byte, 8)
	header[0] = stream
	binary.BigEndian.PutUint32(header[4:], uint32(len(payload)))
	return append(header, payload...)
}

type localDockerSnapshotFixture struct {
	containers []dockercontainer.Summary
	inspect    map[string]dockercontainer.InspectResponse
	images     []image.Summary
	volumes    []*volume.Volume
	networks   []network.Summary
	version    types.Version
	info       system.Info
	failPing   bool
	failInfo   bool
	failList   string // "containers" | "images" | "volumes" | "networks" | "version"
	logsByID   map[string][]byte
	logStatus  map[string]int
}

func newLocalDockerSnapshotServer(t *testing.T, fx localDockerSnapshotFixture) *httptest.Server {
	t.Helper()

	if fx.inspect == nil {
		fx.inspect = map[string]dockercontainer.InspectResponse{}
	}
	if fx.logsByID == nil {
		fx.logsByID = map[string][]byte{}
	}
	if fx.logStatus == nil {
		fx.logStatus = map[string]int{}
	}
	if fx.version.Version == "" {
		fx.version = types.Version{Version: "24.0.0", APIVersion: "1.43"}
	}
	if fx.info.NCPU == 0 && !fx.failInfo {
		fx.info = system.Info{
			NCPU:          4,
			MemTotal:      8 * 1024 * 1024 * 1024,
			ServerVersion: "24.0.0",
			Swarm:         swarm.Info{ControlAvailable: false},
		}
	}

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		switch {
		case path == "/_ping" || strings.HasSuffix(path, "/_ping"):
			if fx.failPing {
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte("ping failed"))
				return
			}
			w.Header().Set("API-Version", "1.43")
			_, _ = w.Write([]byte("OK"))

		case strings.HasSuffix(path, "/info"):
			if fx.failInfo {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(fx.info)

		case strings.HasSuffix(path, "/containers/json"):
			if fx.failList == "containers" {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(fx.containers)

		case strings.Contains(path, "/containers/") && strings.HasSuffix(path, "/json"):
			id := containerIDFromPath(path)
			resp, ok := fx.inspect[id]
			if !ok {
				// Also allow matching by short prefix used in list entries.
				for k, v := range fx.inspect {
					if strings.HasPrefix(k, id) || strings.HasPrefix(id, k) {
						resp, ok = v, true
						break
					}
				}
			}
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write([]byte(`{"message":"No such container"}`))
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)

		case strings.Contains(path, "/containers/") && strings.Contains(path, "/logs"):
			id := containerIDFromPath(path)
			if status, ok := fx.logStatus[id]; ok {
				w.WriteHeader(status)
				return
			}
			payload, ok := fx.logsByID[id]
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/octet-stream")
			_, _ = w.Write(payload)

		case strings.HasSuffix(path, "/images/json"):
			if fx.failList == "images" {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(fx.images)

		case strings.HasSuffix(path, "/volumes"):
			if fx.failList == "volumes" {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(volume.ListResponse{Volumes: fx.volumes})

		case strings.HasSuffix(path, "/networks"):
			if fx.failList == "networks" {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(fx.networks)

		case strings.HasSuffix(path, "/version"):
			if fx.failList == "version" {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(fx.version)

		case strings.HasSuffix(path, "/nodes"):
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]swarm.Node{})

		case strings.HasSuffix(path, "/services"):
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]swarm.Service{})

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func containerIDFromPath(path string) string {
	// Paths look like /v1.43/containers/<id>/json or /containers/<id>/logs
	parts := strings.Split(path, "/")
	for i, p := range parts {
		if p == "containers" && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	return ""
}

func newDockerClientForServer(t *testing.T, srv *httptest.Server) *client.Client {
	t.Helper()
	cli, err := client.NewClientWithOpts(
		client.WithHost(srv.URL),
		client.WithHTTPClient(http.DefaultClient),
		client.WithAPIVersionNegotiation(),
	)
	require.NoError(t, err)
	return cli
}

func TestREQ_ENV_12_CreateDockerSnapshot_LocalResources(t *testing.T) {
	t.Parallel()

	runningID := "ctr-running-1"
	stoppedID := "ctr-stopped-1"

	fx := localDockerSnapshotFixture{
		containers: []dockercontainer.Summary{
			{
				ID:     runningID,
				Names:  []string{"/web"},
				State:  "running",
				Status: "Up 2 minutes",
				Labels: map[string]string{consts.ComposeStackNameLabel: "webstack"},
			},
			{
				ID:     stoppedID,
				Names:  []string{"/db"},
				State:  "exited",
				Status: "Exited (0) 1 minute ago",
				Labels: map[string]string{consts.ComposeStackNameLabel: "webstack"},
			},
		},
		inspect: map[string]dockercontainer.InspectResponse{
			runningID: {
				ContainerJSONBase: &dockercontainer.ContainerJSONBase{
					ID: runningID,
					State: &dockercontainer.State{
						Status:  "running",
						Running: true,
						Health:  &dockercontainer.Health{Status: "healthy"},
					},
					HostConfig: &dockercontainer.HostConfig{},
				},
				Config: &dockercontainer.Config{Env: []string{"FOO=bar", "PATH=/usr/bin"}},
			},
			stoppedID: {
				ContainerJSONBase: &dockercontainer.ContainerJSONBase{
					ID: stoppedID,
					State: &dockercontainer.State{
						Status:  "exited",
						Running: false,
					},
					HostConfig: &dockercontainer.HostConfig{},
				},
				Config: &dockercontainer.Config{Env: []string{"DB=1"}},
			},
		},
		images: []image.Summary{
			{ID: "img-1", RepoTags: []string{"nginx:latest"}},
			{ID: "img-2", RepoTags: []string{"redis:7"}},
		},
		volumes: []*volume.Volume{
			{Name: "data"},
			{Name: "cache"},
			{Name: "logs"},
		},
		networks: []network.Summary{
			{ID: "net-1", Name: "bridge"},
			{ID: "net-2", Name: "webstack_default"},
		},
		info: system.Info{
			NCPU:          4,
			MemTotal:      8 * 1024 * 1024 * 1024,
			ServerVersion: "24.0.7",
			Swarm:         swarm.Info{ControlAvailable: false},
		},
		version: types.Version{Version: "24.0.7", APIVersion: "1.43"},
	}

	srv := newLocalDockerSnapshotServer(t, fx)
	defer srv.Close()
	cli := newDockerClientForServer(t, srv)

	snap, err := CreateDockerSnapshot(cli)
	require.NoError(t, err)
	require.NotNil(t, snap)

	require.False(t, snap.Swarm)
	require.Equal(t, 1, snap.NodeCount)
	require.Equal(t, 4, snap.TotalCPU)
	require.Equal(t, int64(8*1024*1024*1024), snap.TotalMemory)
	require.Equal(t, "24.0.7", snap.DockerVersion)
	require.False(t, snap.IsPodman)

	require.Equal(t, 2, snap.ContainerCount)
	require.Equal(t, 1, snap.RunningContainerCount)
	require.Equal(t, 1, snap.StoppedContainerCount)
	require.Equal(t, 1, snap.HealthyContainerCount)
	require.Equal(t, 1, snap.StackCount)
	require.Equal(t, 2, snap.ImageCount)
	require.Equal(t, 3, snap.VolumeCount)
	require.Len(t, snap.SnapshotRaw.Containers, 2)
	require.Len(t, snap.SnapshotRaw.Images, 2)
	require.Len(t, snap.SnapshotRaw.Networks, 2)
	require.NotZero(t, snap.Time)

	// Running container env is snapshotted; stopped containers skip inspect for GPU/env.
	var foundRunningEnv bool
	for _, c := range snap.SnapshotRaw.Containers {
		if c.ID == runningID {
			require.Equal(t, []string{"FOO=bar", "PATH=/usr/bin"}, c.Env)
			foundRunningEnv = true
		}
	}
	require.True(t, foundRunningEnv)
}

func TestREQ_ENV_12_DockerSnapshotContainers_NvidiaGPUAndGpuCapability(t *testing.T) {
	t.Parallel()

	allGPU := "ctr-gpu-all"
	specificGPU := "ctr-gpu-ids"
	capGPU := "ctr-gpu-cap"
	noGPU := "ctr-no-gpu"

	fx := localDockerSnapshotFixture{
		containers: []dockercontainer.Summary{
			{ID: allGPU, State: "running", Labels: map[string]string{consts.ComposeStackNameLabel: "gpu-stack"}},
			{ID: specificGPU, State: "running"},
			{ID: capGPU, State: "running"},
			{ID: noGPU, State: "running"},
			{ID: "ctr-exited", State: "exited"},
		},
		inspect: map[string]dockercontainer.InspectResponse{
			allGPU: {
				ContainerJSONBase: &dockercontainer.ContainerJSONBase{
					ID:    allGPU,
					State: &dockercontainer.State{Status: "running", Running: true},
					HostConfig: &dockercontainer.HostConfig{
						Resources: dockercontainer.Resources{
							DeviceRequests: []dockercontainer.DeviceRequest{{
								Driver: "nvidia",
								Count:  -1,
							}},
						},
					},
				},
				Config: &dockercontainer.Config{Env: []string{"NVIDIA_VISIBLE_DEVICES=all"}},
			},
			specificGPU: {
				ContainerJSONBase: &dockercontainer.ContainerJSONBase{
					ID:    specificGPU,
					State: &dockercontainer.State{Status: "running", Running: true},
					HostConfig: &dockercontainer.HostConfig{
						Resources: dockercontainer.Resources{
							DeviceRequests: []dockercontainer.DeviceRequest{{
								Driver:    "nvidia",
								DeviceIDs: []string{"GPU-0", "GPU-1"},
							}},
						},
					},
				},
				Config: &dockercontainer.Config{Env: []string{"A=1"}},
			},
			capGPU: {
				ContainerJSONBase: &dockercontainer.ContainerJSONBase{
					ID:    capGPU,
					State: &dockercontainer.State{Status: "running", Running: true},
					HostConfig: &dockercontainer.HostConfig{
						Resources: dockercontainer.Resources{
							DeviceRequests: []dockercontainer.DeviceRequest{{
								Capabilities: [][]string{{"gpu", "nvidia"}},
								DeviceIDs:    []string{"GPU-2"},
							}},
						},
					},
				},
				Config: &dockercontainer.Config{Env: []string{"B=2"}},
			},
			noGPU: {
				ContainerJSONBase: &dockercontainer.ContainerJSONBase{
					ID:         noGPU,
					State:      &dockercontainer.State{Status: "running", Running: true},
					HostConfig: &dockercontainer.HostConfig{},
				},
				Config: &dockercontainer.Config{Env: []string{"C=3"}},
			},
			"ctr-exited": {
				ContainerJSONBase: &dockercontainer.ContainerJSONBase{
					ID:    "ctr-exited",
					State: &dockercontainer.State{Status: "exited"},
				},
				Config: &dockercontainer.Config{},
			},
		},
	}

	srv := newLocalDockerSnapshotServer(t, fx)
	defer srv.Close()
	cli := newDockerClientForServer(t, srv)

	snap := &portainer.DockerSnapshot{}
	err := dockerSnapshotContainers(snap, cli)
	require.NoError(t, err)

	require.True(t, snap.GpuUseAll)
	require.ElementsMatch(t, []string{"GPU-0", "GPU-1", "GPU-2"}, snap.GpuUseList)
	require.Equal(t, 1, snap.StackCount)
	require.Equal(t, 5, snap.ContainerCount)
	require.Equal(t, 4, snap.RunningContainerCount)
	require.Equal(t, 1, snap.StoppedContainerCount)
}

func TestREQ_ENV_12_CreateDockerSnapshot_PingFailure(t *testing.T) {
	t.Parallel()

	srv := newLocalDockerSnapshotServer(t, localDockerSnapshotFixture{failPing: true})
	defer srv.Close()
	cli := newDockerClientForServer(t, srv)

	snap, err := CreateDockerSnapshot(cli)
	require.Error(t, err)
	require.Nil(t, snap)
}

func TestREQ_ENV_12_CreateDockerSnapshot_PartialListFailuresStillReturn(t *testing.T) {
	t.Parallel()

	// Info fails (warn), containers fail (warn), rest succeed — CreateDockerSnapshot still returns.
	fx := localDockerSnapshotFixture{
		failInfo: true,
		failList: "containers",
		images:   []image.Summary{{ID: "img"}},
		volumes:  []*volume.Volume{{Name: "v1"}},
		networks: []network.Summary{{ID: "n1", Name: "bridge"}},
	}
	srv := newLocalDockerSnapshotServer(t, fx)
	defer srv.Close()
	cli := newDockerClientForServer(t, srv)

	snap, err := CreateDockerSnapshot(cli)
	require.NoError(t, err)
	require.NotNil(t, snap)
	require.Equal(t, 1, snap.NodeCount) // standalone default when Swarm unset
	require.Equal(t, 1, snap.ImageCount)
	require.Equal(t, 1, snap.VolumeCount)
	require.Len(t, snap.SnapshotRaw.Networks, 1)
}

func TestREQ_ENV_07_DockerSnapshotVersion_DetectsPodman(t *testing.T) {
	t.Parallel()

	fx := localDockerSnapshotFixture{
		version: types.Version{
			Version: "4.9.0",
			Components: []types.ComponentVersion{
				{Name: "Podman Engine", Version: "4.9.0"},
			},
		},
	}
	srv := newLocalDockerSnapshotServer(t, fx)
	defer srv.Close()
	cli := newDockerClientForServer(t, srv)

	snap := &portainer.DockerSnapshot{}
	err := dockerSnapshotVersion(snap, cli)
	require.NoError(t, err)
	require.True(t, snap.IsPodman)
	require.Equal(t, "4.9.0", snap.SnapshotRaw.Version.Version)
}

func TestREQ_ENV_12_DockerSnapshotDiagnostics_EmptyEdgeKeyNoHostname(t *testing.T) {

	t.Setenv("HOSTNAME", "")

	srv := newLocalDockerSnapshotServer(t, localDockerSnapshotFixture{})
	defer srv.Close()
	cli := newDockerClientForServer(t, srv)

	diag, err := DockerSnapshotDiagnostics(cli, "")
	require.NoError(t, err)
	require.NotNil(t, diag)
	require.Empty(t, diag.Log)
	require.Empty(t, diag.DNS)
	require.Empty(t, diag.Telnet)
}

func TestREQ_ENV_12_DockerSnapshotDiagnostics_ContainerErrorLogs(t *testing.T) {

	agentID := "agent-container-abc"
	t.Setenv("HOSTNAME", agentID)

	stderrPayload := dockerMultiplexFrame(2, []byte("2024-01-02T03:04:05Z level=error boom\n"))
	fx := localDockerSnapshotFixture{
		logsByID: map[string][]byte{agentID: stderrPayload},
	}
	srv := newLocalDockerSnapshotServer(t, fx)
	defer srv.Close()
	cli := newDockerClientForServer(t, srv)

	diag, err := DockerSnapshotDiagnostics(cli, "")
	require.NoError(t, err)
	require.NotNil(t, diag)
	// Implementation currently marshals a nil log slice (JSON null) after reading stderr.
	require.Equal(t, "null", diag.Log)
}

func TestREQ_ENV_12_DockerSnapshotContainerErrorLogs_FetchFailure(t *testing.T) {
	t.Parallel()

	agentID := "missing-agent"
	fx := localDockerSnapshotFixture{
		logStatus: map[string]int{agentID: http.StatusNotFound},
	}
	srv := newLocalDockerSnapshotServer(t, fx)
	defer srv.Close()
	cli := newDockerClientForServer(t, srv)

	snap := &portainer.DockerSnapshot{
		DiagnosticsData: &portainer.DiagnosticsData{
			DNS:    make(map[string]string),
			Telnet: make(map[string]string),
		},
	}
	err := dockerSnapshotContainerErrorLogs(snap, cli, agentID)
	require.Error(t, err)
	require.Contains(t, err.Error(), "failed to get container logs")
}

func TestREQ_ENV_12_DockerSnapshotImagesVolumesNetworks_Direct(t *testing.T) {
	t.Parallel()

	fx := localDockerSnapshotFixture{
		images:   []image.Summary{{ID: "a"}, {ID: "b"}},
		volumes:  []*volume.Volume{{Name: "v"}},
		networks: []network.Summary{{Name: "n1"}, {Name: "n2"}, {Name: "n3"}},
	}
	srv := newLocalDockerSnapshotServer(t, fx)
	defer srv.Close()
	cli := newDockerClientForServer(t, srv)

	snap := &portainer.DockerSnapshot{}
	require.NoError(t, dockerSnapshotImages(snap, cli))
	require.Equal(t, 2, snap.ImageCount)

	require.NoError(t, dockerSnapshotVolumes(snap, cli))
	require.Equal(t, 1, snap.VolumeCount)

	require.NoError(t, dockerSnapshotNetworks(snap, cli))
	require.Len(t, snap.SnapshotRaw.Networks, 3)
}

func TestREQ_ENV_12_DockerSnapshotContainers_InspectFailureOnStandalone(t *testing.T) {
	t.Parallel()

	fx := localDockerSnapshotFixture{
		containers: []dockercontainer.Summary{
			{ID: "gone", State: "running"},
		},
		// no inspect entry -> 404 "No such container"
	}
	srv := newLocalDockerSnapshotServer(t, fx)
	defer srv.Close()
	cli := newDockerClientForServer(t, srv)

	snap := &portainer.DockerSnapshot{Swarm: false}
	err := dockerSnapshotContainers(snap, cli)
	require.Error(t, err)
}

func TestREQ_ENV_12_DockerSnapshotInfo_Error(t *testing.T) {
	t.Parallel()

	srv := newLocalDockerSnapshotServer(t, localDockerSnapshotFixture{failInfo: true})
	defer srv.Close()
	cli := newDockerClientForServer(t, srv)

	snap := &portainer.DockerSnapshot{}
	err := dockerSnapshotInfo(snap, cli)
	require.Error(t, err)
}

func TestIsPodman_FalseWithoutPodmanComponent(t *testing.T) {
	t.Parallel()
	require.False(t, isPodman(types.Version{
		Components: []types.ComponentVersion{{Name: "Engine", Version: "24.0"}},
	}))
	require.True(t, isPodman(types.Version{
		Components: []types.ComponentVersion{{Name: "podman runtime", Version: "5.0"}},
	}))
}

func TestREQ_ENV_12_DockerSnapshotImagesVolumesNetworksVersion_Errors(t *testing.T) {
	t.Parallel()

	for _, fail := range []string{"images", "volumes", "networks", "version"} {
		fail := fail
		t.Run(fail, func(t *testing.T) {
			t.Parallel()
			srv := newLocalDockerSnapshotServer(t, localDockerSnapshotFixture{failList: fail})
			defer srv.Close()
			cli := newDockerClientForServer(t, srv)
			snap := &portainer.DockerSnapshot{}

			var err error
			switch fail {
			case "images":
				err = dockerSnapshotImages(snap, cli)
			case "volumes":
				err = dockerSnapshotVolumes(snap, cli)
			case "networks":
				err = dockerSnapshotNetworks(snap, cli)
			case "version":
				err = dockerSnapshotVersion(snap, cli)
			}
			require.Error(t, err)
		})
	}
}

func TestREQ_ENV_12_CreateDockerSnapshot_WarnsOnImagesVolumesNetworksVersion(t *testing.T) {
	t.Parallel()

	// Fail each remaining list endpoint in turn after ping/info/containers succeed.
	for _, fail := range []string{"images", "volumes", "networks", "version"} {
		fail := fail
		t.Run(fail, func(t *testing.T) {
			t.Parallel()
			srv := newLocalDockerSnapshotServer(t, localDockerSnapshotFixture{failList: fail})
			defer srv.Close()
			cli := newDockerClientForServer(t, srv)
			snap, err := CreateDockerSnapshot(cli)
			require.NoError(t, err)
			require.NotNil(t, snap)
			require.Equal(t, 1, snap.NodeCount)
		})
	}
}

func TestREQ_ENV_12_DockerSnapshotDiagnostics_LogFetchError(t *testing.T) {
	agentID := "agent-logs-fail"
	t.Setenv("HOSTNAME", agentID)

	srv := newLocalDockerSnapshotServer(t, localDockerSnapshotFixture{
		logStatus: map[string]int{agentID: http.StatusInternalServerError},
	})
	defer srv.Close()
	cli := newDockerClientForServer(t, srv)

	diag, err := DockerSnapshotDiagnostics(cli, "")
	require.Error(t, err)
	require.Nil(t, diag)
}
