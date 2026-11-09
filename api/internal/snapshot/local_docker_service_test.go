package snapshot_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/internal/snapshot"
	"github.com/portainer/portainer/api/pendingactions"
	"github.com/portainer/portainer/pkg/fips"

	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/api/types/system"
	"github.com/stretchr/testify/require"
)

type recordingTunnelService struct {
	opened []portainer.EndpointID
	err    error
}

func (s *recordingTunnelService) StartTunnelServer(addr, port string, snapshotService portainer.SnapshotService) error {
	return nil
}
func (s *recordingTunnelService) StopTunnelServer() error { return nil }
func (s *recordingTunnelService) GenerateEdgeKey(apiURL, tunnelAddr string, endpointIdentifier int) string {
	return ""
}
func (s *recordingTunnelService) Open(endpoint *portainer.Endpoint) error {
	s.opened = append(s.opened, endpoint.ID)
	return s.err
}
func (s *recordingTunnelService) Config(endpointID portainer.EndpointID) portainer.TunnelDetails {
	return portainer.TunnelDetails{}
}
func (s *recordingTunnelService) TunnelAddr(endpoint *portainer.Endpoint) (string, error) {
	return "", nil
}
func (s *recordingTunnelService) UpdateLastActivity(endpointID portainer.EndpointID) {}
func (s *recordingTunnelService) KeepTunnelAlive(endpointID portainer.EndpointID, ctx context.Context, maxKeepAlive time.Duration) {
}

func newServiceWithPending(
	t *testing.T,
	interval string,
	dockerSnapshotter portainer.DockerSnapshotter,
	kubernetesSnapshotter portainer.KubernetesSnapshotter,
) (*snapshot.Service, *datastore.Store, *pendingactions.PendingActionsService) {
	t.Helper()

	_, store := datastore.MustNewTestStore(t, true, false)
	pending := pendingactions.NewService(store, nil)
	service, err := snapshot.NewService(interval, store, dockerSnapshotter, kubernetesSnapshotter, pending)
	require.NoError(t, err)

	return service, store, pending
}

func createLocalDockerEndpoint(t *testing.T, store *datastore.Store, id portainer.EndpointID, url string) *portainer.Endpoint {
	t.Helper()

	endpoint := &portainer.Endpoint{
		ID:     id,
		Name:   "local-docker",
		Type:   portainer.DockerEnvironment,
		URL:    url,
		Status: portainer.EndpointStatusDown,
	}
	require.NoError(t, store.Endpoint().Create(endpoint))

	return endpoint
}

func TestREQ_ENV_12_SupportDirectSnapshot_LocalDockerAndDeferredTypes(t *testing.T) {
	t.Parallel()

	require.True(t, snapshot.SupportDirectSnapshot(&portainer.Endpoint{Type: portainer.DockerEnvironment}))
	require.True(t, snapshot.SupportDirectSnapshot(&portainer.Endpoint{Type: portainer.AgentOnDockerEnvironment}))
	require.True(t, snapshot.SupportDirectSnapshot(&portainer.Endpoint{Type: portainer.KubernetesLocalEnvironment}))

	require.False(t, snapshot.SupportDirectSnapshot(&portainer.Endpoint{Type: portainer.EdgeAgentOnDockerEnvironment}))
	require.False(t, snapshot.SupportDirectSnapshot(&portainer.Endpoint{Type: portainer.EdgeAgentOnKubernetesEnvironment}))
	require.False(t, snapshot.SupportDirectSnapshot(&portainer.Endpoint{Type: portainer.AzureEnvironment}))
}

func TestREQ_ENV_12_NewService_ParsesFlagIntervalAndRejectsInvalid(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)

	service, err := snapshot.NewService("10m", store, stubDockerSnapshotter{}, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, service)

	_, err = snapshot.NewService("not-a-duration", store, stubDockerSnapshotter{}, nil, nil)
	require.Error(t, err)
}

func TestREQ_ENV_12_NewService_UsesSettingsSnapshotIntervalWhenFlagEmpty(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	settings.SnapshotInterval = "7m"
	require.NoError(t, store.Settings().UpdateSettings(settings))

	service, err := snapshot.NewService("", store, stubDockerSnapshotter{}, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, service)
}

func TestREQ_ENV_12_NewService_FallsBackToDefaultInterval(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	settings, err := store.Settings().Settings()
	require.NoError(t, err)
	settings.SnapshotInterval = ""
	require.NoError(t, store.Settings().UpdateSettings(settings))

	service, err := snapshot.NewService("", store, stubDockerSnapshotter{}, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, service)
}

func TestREQ_ENV_12_SetSnapshotInterval_RejectsInvalidDuration(t *testing.T) {
	t.Parallel()

	service, _ := newTestService(t, stubDockerSnapshotter{}, nil)
	err := service.SetSnapshotInterval("bogus")
	require.Error(t, err)
}

func TestREQ_ENV_12_Create_PersistsSnapshot(t *testing.T) {
	t.Parallel()

	service, store := newTestService(t, stubDockerSnapshotter{}, nil)
	err := service.Create(portainer.Snapshot{
		EndpointID: 42,
		Docker:     &portainer.DockerSnapshot{DockerVersion: "27.0"},
	})
	require.NoError(t, err)

	persisted, err := store.Snapshot().Read(42)
	require.NoError(t, err)
	require.NotNil(t, persisted.Docker)
	require.Equal(t, "27.0", persisted.Docker.DockerVersion)
}

func TestREQ_ENV_12_FillSnapshotData_LocalDockerWithAndWithoutRaw(t *testing.T) {
	t.Parallel()

	service, store := newTestService(t, stubDockerSnapshotter{}, nil)
	endpoint := &portainer.Endpoint{ID: 7, Type: portainer.DockerEnvironment}

	require.NoError(t, store.Snapshot().Create(&portainer.Snapshot{
		EndpointID: endpoint.ID,
		Docker: &portainer.DockerSnapshot{
			DockerVersion: "26.1",
			SnapshotRaw: portainer.DockerSnapshotRaw{
				Info: system.Info{ID: "engine-raw-id"},
			},
		},
	}))

	require.NoError(t, service.FillSnapshotData(endpoint, true))
	require.Len(t, endpoint.Snapshots, 1)
	require.Equal(t, "26.1", endpoint.Snapshots[0].DockerVersion)
	require.Equal(t, "engine-raw-id", endpoint.Snapshots[0].SnapshotRaw.Info.ID)

	endpointWithoutRaw := &portainer.Endpoint{ID: 7, Type: portainer.DockerEnvironment}
	require.NoError(t, service.FillSnapshotData(endpointWithoutRaw, false))
	require.Len(t, endpointWithoutRaw.Snapshots, 1)
	require.Equal(t, "26.1", endpointWithoutRaw.Snapshots[0].DockerVersion)
}

func TestREQ_ENV_12_FillSnapshotData_MissingSnapshotClearsSlices(t *testing.T) {
	t.Parallel()

	service, _ := newTestService(t, stubDockerSnapshotter{}, nil)
	endpoint := &portainer.Endpoint{
		ID:        99,
		Type:      portainer.DockerEnvironment,
		Snapshots: []portainer.DockerSnapshot{{DockerVersion: "stale"}},
	}

	require.NoError(t, service.FillSnapshotData(endpoint, true))
	require.Empty(t, endpoint.Snapshots)
	require.Empty(t, endpoint.Kubernetes.Snapshots)
}

func TestREQ_ENV_12_FillSnapshotData_PackageHelper_NotFoundAndDocker(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	endpoint := &portainer.Endpoint{ID: 3, Type: portainer.DockerEnvironment}

	require.NoError(t, snapshot.FillSnapshotData(store, endpoint, false))
	require.Empty(t, endpoint.Snapshots)
	require.Empty(t, endpoint.Kubernetes.Snapshots)

	require.NoError(t, store.Snapshot().Create(&portainer.Snapshot{
		EndpointID: endpoint.ID,
		Docker:     &portainer.DockerSnapshot{DockerVersion: "25.0", TotalCPU: 4},
	}))

	require.NoError(t, snapshot.FillSnapshotData(store, endpoint, true))
	require.Len(t, endpoint.Snapshots, 1)
	require.Equal(t, 4, endpoint.Snapshots[0].TotalCPU)
}

func TestREQ_ENV_12_FetchDockerID_StandaloneAndSwarm(t *testing.T) {
	t.Parallel()

	standaloneID, err := snapshot.FetchDockerID(portainer.DockerSnapshot{
		Swarm: false,
		SnapshotRaw: portainer.DockerSnapshotRaw{
			Info: system.Info{ID: "standalone-engine"},
		},
	})
	require.NoError(t, err)
	require.Equal(t, "standalone-engine", standaloneID)

	swarmID, err := snapshot.FetchDockerID(portainer.DockerSnapshot{
		Swarm: true,
		SnapshotRaw: portainer.DockerSnapshotRaw{
			Info: system.Info{
				ID: "node-id",
				Swarm: swarm.Info{
					Cluster: &swarm.ClusterInfo{ID: "cluster-abc"},
				},
			},
		},
	})
	require.NoError(t, err)
	require.Equal(t, "cluster-abc", swarmID)

	_, err = snapshot.FetchDockerID(portainer.DockerSnapshot{
		Swarm: true,
		SnapshotRaw: portainer.DockerSnapshotRaw{
			Info: system.Info{ID: "node-id", Swarm: swarm.Info{Cluster: nil}},
		},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "missing cluster info")
}

func TestREQ_ENV_12_SnapshotEndpointTx_DockerSnapshotterError(t *testing.T) {
	t.Parallel()

	service, store := newTestService(t, stubDockerSnapshotter{err: errors.New("daemon unreachable")}, nil)
	endpoint := &portainer.Endpoint{ID: 1, Type: portainer.DockerEnvironment}

	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return service.SnapshotEndpointTx(tx, endpoint)
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "daemon unreachable")
}

func TestREQ_ENV_12_SnapshotEndpointTx_PodmanEngineRejectsDockerSnapshot(t *testing.T) {
	t.Parallel()

	service, store := newTestService(t, stubDockerSnapshotter{snapshot: &portainer.DockerSnapshot{IsPodman: false}}, nil)
	endpoint := &portainer.Endpoint{
		ID:              1,
		Type:            portainer.DockerEnvironment,
		ContainerEngine: portainer.ContainerEnginePodman,
	}

	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return service.SnapshotEndpointTx(tx, endpoint)
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "Podman environment option")
}

func TestREQ_ENV_12_SnapshotEndpointTx_AgentOnDocker_FetchesVersionAndPersists(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)

	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(portainer.PortainerAgentHeader, "2.27.0")
		w.Header().Set(portainer.HTTPResponseAgentPlatform, "1")
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(srv.Close)

	dockerSnapshot := &portainer.DockerSnapshot{DockerVersion: "27.1"}
	service, store := newTestService(t, stubDockerSnapshotter{snapshot: dockerSnapshot}, nil)
	endpoint := &portainer.Endpoint{
		ID:   11,
		Type: portainer.AgentOnDockerEnvironment,
		URL:  srv.URL,
		TLSConfig: portainer.TLSConfiguration{
			TLS:           true,
			TLSSkipVerify: true,
		},
	}

	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return service.SnapshotEndpointTx(tx, endpoint)
	})
	require.NoError(t, err)
	require.Equal(t, "2.27.0", endpoint.Agent.Version)

	persisted, err := store.Snapshot().Read(endpoint.ID)
	require.NoError(t, err)
	require.NotNil(t, persisted.Docker)
}

func TestREQ_ENV_12_SnapshotEndpointTx_AgentOnDocker_AgentUnreachable(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)

	service, store := newTestService(t, stubDockerSnapshotter{snapshot: &portainer.DockerSnapshot{}}, nil)
	endpoint := &portainer.Endpoint{
		ID:   12,
		Type: portainer.AgentOnDockerEnvironment,
		URL:  "https://127.0.0.1:1",
		TLSConfig: portainer.TLSConfiguration{
			TLS:           true,
			TLSSkipVerify: true,
		},
	}

	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return service.SnapshotEndpointTx(tx, endpoint)
	})
	require.Error(t, err)
}

func TestREQ_ENV_12_Start_SnapshotsLocalDockerAndMarksEndpointUp(t *testing.T) {
	dockerSnapshot := &portainer.DockerSnapshot{DockerVersion: "26.0", TotalCPU: 2}
	service, store, _ := newServiceWithPending(t, "1h", stubDockerSnapshotter{snapshot: dockerSnapshot}, nil)
	createLocalDockerEndpoint(t, store, 1, "unix:///var/run/docker.sock")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	service.Start(ctx)

	require.Eventually(t, func() bool {
		ep, err := store.Endpoint().Endpoint(1)
		if err != nil {
			return false
		}
		return ep.Status == portainer.EndpointStatusUp
	}, 3*time.Second, 25*time.Millisecond)

	persisted, err := store.Snapshot().Read(1)
	require.NoError(t, err)
	require.NotNil(t, persisted.Docker)
	require.Equal(t, "26.0", persisted.Docker.DockerVersion)

	cancel()
}

func TestREQ_ENV_12_Start_MarksEndpointDownOnSnapshotFailure(t *testing.T) {
	service, store, _ := newServiceWithPending(t, "1h", stubDockerSnapshotter{err: errors.New("snap failed")}, nil)
	createLocalDockerEndpoint(t, store, 2, "unix:///var/run/docker.sock")

	// Seed as Up so we can observe the transition to Down.
	ep, err := store.Endpoint().Endpoint(2)
	require.NoError(t, err)
	ep.Status = portainer.EndpointStatusUp
	require.NoError(t, store.Endpoint().UpdateEndpoint(2, ep))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	service.Start(ctx)

	require.Eventually(t, func() bool {
		latest, err := store.Endpoint().Endpoint(2)
		if err != nil {
			return false
		}
		return latest.Status == portainer.EndpointStatusDown
	}, 3*time.Second, 25*time.Millisecond)

	cancel()
}

func TestREQ_ENV_12_Start_SkipsEdgeAndEmptyURLEndpoints(t *testing.T) {
	var created int
	counting := stubDockerSnapshotter{
		snapshot: &portainer.DockerSnapshot{DockerVersion: "1"},
	}
	// Wrap via a custom stub that counts — reuse CreateSnapshot side effect with a local type.
	countingSnapper := &countingDockerSnapshotter{inner: counting, count: &created}

	service, store, _ := newServiceWithPending(t, "1h", countingSnapper, nil)

	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   1,
		Name: "edge",
		Type: portainer.EdgeAgentOnDockerEnvironment,
		URL:  "http://edge",
	}))
	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   2,
		Name: "empty-url",
		Type: portainer.DockerEnvironment,
		URL:  "",
	}))
	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   3,
		Name: "local",
		Type: portainer.DockerEnvironment,
		URL:  "unix:///var/run/docker.sock",
	}))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	service.Start(ctx)

	require.Eventually(t, func() bool {
		return created >= 1
	}, 3*time.Second, 25*time.Millisecond)

	// Only the local Docker endpoint with a URL should be snapshotted.
	require.Equal(t, 1, created)

	cancel()
}

type countingDockerSnapshotter struct {
	inner stubDockerSnapshotter
	count *int
}

func (c *countingDockerSnapshotter) CreateSnapshot(endpoint *portainer.Endpoint) (*portainer.DockerSnapshot, error) {
	*c.count++
	return c.inner.CreateSnapshot(endpoint)
}

func TestREQ_ENV_12_SetSnapshotInterval_ResetsTickerWhileRunning(t *testing.T) {
	service, store, _ := newServiceWithPending(t, "1h", stubDockerSnapshotter{snapshot: &portainer.DockerSnapshot{}}, nil)
	createLocalDockerEndpoint(t, store, 5, "unix:///var/run/docker.sock")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	service.Start(ctx)

	require.Eventually(t, func() bool {
		ep, err := store.Endpoint().Endpoint(5)
		return err == nil && ep.Status == portainer.EndpointStatusUp
	}, 3*time.Second, 25*time.Millisecond)

	require.NoError(t, service.SetSnapshotInterval("2h"))

	// Give the loop a moment to receive the interval reset without hanging.
	time.Sleep(50 * time.Millisecond)
	cancel()
}

func TestREQ_ENV_12_NewBackgroundSnapshotter_OpensTunnelForLocalDockerWithoutSnapshot(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   8,
		Name: "local",
		Type: portainer.DockerEnvironment,
		URL:  "unix:///var/run/docker.sock",
	}))

	tunnel := &recordingTunnelService{}
	snapshot.NewBackgroundSnapshotter(store, tunnel)
	require.Equal(t, []portainer.EndpointID{8}, tunnel.opened)
}

func TestREQ_ENV_12_NewBackgroundSnapshotter_SkipsWhenDockerSnapshotExists(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   9,
		Name: "local",
		Type: portainer.DockerEnvironment,
		URL:  "unix:///var/run/docker.sock",
	}))
	require.NoError(t, store.Snapshot().Create(&portainer.Snapshot{
		EndpointID: 9,
		Docker:     &portainer.DockerSnapshot{DockerVersion: "26"},
	}))

	tunnel := &recordingTunnelService{}
	snapshot.NewBackgroundSnapshotter(store, tunnel)
	require.Empty(t, tunnel.opened)
}

func TestREQ_ENV_12_NewBackgroundSnapshotter_OpenErrorIsLoggedNotFatal(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   10,
		Name: "local",
		Type: portainer.DockerEnvironment,
		URL:  "unix:///var/run/docker.sock",
	}))

	tunnel := &recordingTunnelService{err: errors.New("tunnel failed")}
	snapshot.NewBackgroundSnapshotter(store, tunnel)
	require.Equal(t, []portainer.EndpointID{10}, tunnel.opened)
}
