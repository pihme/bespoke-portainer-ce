package postinit

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	dockerClient "github.com/portainer/portainer/api/docker/client"
	"github.com/portainer/portainer/api/pendingactions/actions"
	"github.com/portainer/portainer/pkg/fips"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	fips.InitFIPS(false)
	os.Exit(m.Run())
}

func TestMigrateGPUs(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/containers/json") {
			containerSummary := []container.Summary{{ID: "container1"}}

			if err := json.NewEncoder(w).Encode(containerSummary); err != nil {
				w.WriteHeader(http.StatusInternalServerError)
			}

			return
		}

		container := container.InspectResponse{
			ContainerJSONBase: &container.ContainerJSONBase{
				ID: "container1",
				HostConfig: &container.HostConfig{
					Resources: container.Resources{
						DeviceRequests: []container.DeviceRequest{
							{Driver: "nvidia"},
						},
					},
				},
			},
		}

		if err := json.NewEncoder(w).Encode(container); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
		}
	}))
	defer srv.Close()

	_, store := datastore.MustNewTestStore(t, true, false)

	migrator := &PostInitMigrator{dataStore: store}

	dockerCli, err := client.NewClientWithOpts(client.WithHost(srv.URL), client.WithHTTPClient(http.DefaultClient))
	require.NoError(t, err)

	// Nonexistent endpoint

	err = migrator.MigrateGPUs(portainer.Endpoint{}, dockerCli)
	require.Error(t, err)

	// Valid endpoint

	endpoint := portainer.Endpoint{ID: 1, PostInitMigrations: portainer.EndpointPostInitMigrations{MigrateGPUs: true}}

	err = store.Endpoint().Create(&endpoint)
	require.NoError(t, err)

	err = migrator.MigrateGPUs(endpoint, dockerCli)
	require.NoError(t, err)

	migratedEndpoint, err := store.Endpoint().Endpoint(endpoint.ID)
	require.NoError(t, err)

	require.Equal(t, endpoint.ID, migratedEndpoint.ID)
	require.False(t, migratedEndpoint.PostInitMigrations.MigrateGPUs)
	require.True(t, migratedEndpoint.EnableGPUManagement)
}

func TestPostInitMigrate_PendingActionsCreated(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name                   string
		existingPendingActions []*portainer.PendingAction
		expectedPendingActions int
		expectedAction         string
	}{
		{
			name: "when existing non-matching action exists, should add migration action",
			existingPendingActions: []*portainer.PendingAction{
				{
					EndpointID: 7,
					Action:     "some-other-action",
				},
			},
			expectedPendingActions: 2,
			expectedAction:         actions.PostInitMigrateEnvironment,
		},
		{
			name: "when matching action exists, should not add duplicate",
			existingPendingActions: []*portainer.PendingAction{
				{
					EndpointID: 7,
					Action:     actions.PostInitMigrateEnvironment,
				},
			},
			expectedPendingActions: 1,
			expectedAction:         actions.PostInitMigrateEnvironment,
		},
		{
			name:                   "when no actions exist, should add migration action",
			existingPendingActions: []*portainer.PendingAction{},
			expectedPendingActions: 1,
			expectedAction:         actions.PostInitMigrateEnvironment,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			is := assert.New(t)
			_, store := datastore.MustNewTestStore(t, true, true)

			// Create test endpoint
			endpoint := &portainer.Endpoint{
				ID:          7,
				UserTrusted: true,
				Type:        portainer.EdgeAgentOnDockerEnvironment,
				Edge: portainer.EnvironmentEdgeSettings{
					AsyncMode: false,
				},
				EdgeID: "edgeID",
			}
			err := store.Endpoint().Create(endpoint)
			require.NoError(t, err, "error creating endpoint")

			// Create any existing pending actions
			for _, action := range tt.existingPendingActions {
				err = store.PendingActions().Create(action)
				require.NoError(t, err, "error creating pending action")
			}

			migrator := NewPostInitMigrator(
				nil, // kubeFactory not needed for this test
				nil, // dockerFactory not needed for this test
				store,
				"",  // assetsPath not needed for this test
				nil, // kubernetesDeployer not needed for this test
			)

			err = migrator.PostInitMigrate()
			require.NoError(t, err, "PostInitMigrate should not return error")

			// Verify the results
			pendingActions, err := store.PendingActions().ReadAll()
			require.NoError(t, err, "error reading pending actions")
			is.Len(pendingActions, tt.expectedPendingActions, "unexpected number of pending actions")

			// If we expect any actions, verify at least one has the expected action type
			if tt.expectedPendingActions > 0 {
				hasExpectedAction := false
				for _, action := range pendingActions {
					if action.Action == tt.expectedAction {
						hasExpectedAction = true
						is.Equal(endpoint.ID, action.EndpointID, "action should reference correct endpoint")

						break
					}
				}

				is.True(hasExpectedAction, "should have found action of expected type")
			}
		})
	}
}

func gpuMockServer(t *testing.T, listStatus int, containers []container.Summary, inspect map[string]any) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/_ping" || strings.HasSuffix(r.URL.Path, "/_ping"):
			w.Header().Set("API-Version", "1.43")
			w.Header().Del("Content-Type")
			_, _ = w.Write([]byte("OK"))
		case strings.HasSuffix(r.URL.Path, "/containers/json"):
			if listStatus != 0 && listStatus != http.StatusOK {
				w.WriteHeader(listStatus)
				return
			}
			if err := json.NewEncoder(w).Encode(containers); err != nil {
				w.WriteHeader(http.StatusInternalServerError)
			}
		case strings.Contains(r.URL.Path, "/containers/") && strings.HasSuffix(r.URL.Path, "/json"):
			parts := strings.Split(r.URL.Path, "/")
			// path like /v1.43/containers/<id>/json
			id := ""
			for i, p := range parts {
				if p == "containers" && i+1 < len(parts) {
					id = parts[i+1]
					break
				}
			}
			if inspect == nil {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			body, ok := inspect[id]
			if !ok {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			if _, isErr := body.(error); isErr {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			if err := json.NewEncoder(w).Encode(body); err != nil {
				w.WriteHeader(http.StatusInternalServerError)
			}
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return srv
}

func newDockerCLI(t *testing.T, srv *httptest.Server) *client.Client {
	t.Helper()
	dockerCli, err := client.NewClientWithOpts(client.WithHost(srv.URL), client.WithHTTPClient(http.DefaultClient))
	require.NoError(t, err)
	return dockerCli
}

func nvidiaInspect(id string) container.InspectResponse {
	return container.InspectResponse{
		ContainerJSONBase: &container.ContainerJSONBase{
			ID: id,
			HostConfig: &container.HostConfig{
				Resources: container.Resources{
					DeviceRequests: []container.DeviceRequest{{Driver: "nvidia"}},
				},
			},
		},
	}
}

func plainInspect(id string) container.InspectResponse {
	return container.InspectResponse{
		ContainerJSONBase: &container.ContainerJSONBase{
			ID: id,
			HostConfig: &container.HostConfig{
				Resources: container.Resources{
					DeviceRequests: []container.DeviceRequest{{Driver: "other"}},
				},
			},
		},
	}
}

func TestMigrateGPUs_SkipWhenFlagFalse(t *testing.T) {
	t.Parallel()
	srv := gpuMockServer(t, http.StatusOK, []container.Summary{{ID: "c1"}}, map[string]any{"c1": nvidiaInspect("c1")})
	_, store := datastore.MustNewTestStore(t, true, false)
	migrator := &PostInitMigrator{dataStore: store}

	endpoint := portainer.Endpoint{
		ID:                  11,
		PostInitMigrations:  portainer.EndpointPostInitMigrations{MigrateGPUs: false},
		EnableGPUManagement: false,
	}
	require.NoError(t, store.Endpoint().Create(&endpoint))

	err := migrator.MigrateGPUs(endpoint, newDockerCLI(t, srv))
	require.NoError(t, err)

	got, err := store.Endpoint().Endpoint(endpoint.ID)
	require.NoError(t, err)
	require.False(t, got.PostInitMigrations.MigrateGPUs)
	require.False(t, got.EnableGPUManagement)
}

func TestMigrateGPUs_NoNvidiaDevicesClearsFlag(t *testing.T) {
	t.Parallel()
	srv := gpuMockServer(t, http.StatusOK,
		[]container.Summary{{ID: "c1"}, {ID: "c2"}},
		map[string]any{"c1": plainInspect("c1"), "c2": plainInspect("c2")},
	)
	_, store := datastore.MustNewTestStore(t, true, false)
	migrator := &PostInitMigrator{dataStore: store}

	endpoint := portainer.Endpoint{
		ID:                 12,
		PostInitMigrations: portainer.EndpointPostInitMigrations{MigrateGPUs: true},
	}
	require.NoError(t, store.Endpoint().Create(&endpoint))

	err := migrator.MigrateGPUs(endpoint, newDockerCLI(t, srv))
	require.NoError(t, err)

	got, err := store.Endpoint().Endpoint(endpoint.ID)
	require.NoError(t, err)
	require.False(t, got.PostInitMigrations.MigrateGPUs)
	require.False(t, got.EnableGPUManagement)
}

func TestMigrateGPUs_EmptyContainerListClearsFlag(t *testing.T) {
	t.Parallel()
	srv := gpuMockServer(t, http.StatusOK, []container.Summary{}, map[string]any{})
	_, store := datastore.MustNewTestStore(t, true, false)
	migrator := &PostInitMigrator{dataStore: store}

	endpoint := portainer.Endpoint{
		ID:                 13,
		PostInitMigrations: portainer.EndpointPostInitMigrations{MigrateGPUs: true},
	}
	require.NoError(t, store.Endpoint().Create(&endpoint))

	err := migrator.MigrateGPUs(endpoint, newDockerCLI(t, srv))
	require.NoError(t, err)

	got, err := store.Endpoint().Endpoint(endpoint.ID)
	require.NoError(t, err)
	require.False(t, got.PostInitMigrations.MigrateGPUs)
	require.False(t, got.EnableGPUManagement)
}

func TestMigrateGPUs_ContainerListError(t *testing.T) {
	t.Parallel()
	srv := gpuMockServer(t, http.StatusInternalServerError, nil, nil)
	_, store := datastore.MustNewTestStore(t, true, false)
	migrator := &PostInitMigrator{dataStore: store}

	endpoint := portainer.Endpoint{
		ID:                 14,
		PostInitMigrations: portainer.EndpointPostInitMigrations{MigrateGPUs: true},
	}
	require.NoError(t, store.Endpoint().Create(&endpoint))

	err := migrator.MigrateGPUs(endpoint, newDockerCLI(t, srv))
	require.Error(t, err)

	got, err := store.Endpoint().Endpoint(endpoint.ID)
	require.NoError(t, err)
	require.True(t, got.PostInitMigrations.MigrateGPUs)
}

func TestMigrateGPUs_InspectErrorContinuesAndClearsFlag(t *testing.T) {
	t.Parallel()
	srv := gpuMockServer(t, http.StatusOK,
		[]container.Summary{{ID: "bad"}, {ID: "good"}},
		map[string]any{
			"bad":  assert.AnError,
			"good": plainInspect("good"),
		},
	)
	_, store := datastore.MustNewTestStore(t, true, false)
	migrator := &PostInitMigrator{dataStore: store}

	endpoint := portainer.Endpoint{
		ID:                 15,
		PostInitMigrations: portainer.EndpointPostInitMigrations{MigrateGPUs: true},
	}
	require.NoError(t, store.Endpoint().Create(&endpoint))

	err := migrator.MigrateGPUs(endpoint, newDockerCLI(t, srv))
	require.NoError(t, err)

	got, err := store.Endpoint().Endpoint(endpoint.ID)
	require.NoError(t, err)
	require.False(t, got.PostInitMigrations.MigrateGPUs)
	require.False(t, got.EnableGPUManagement)
}

func TestMigrateEnvironment_DockerSuccessEnablesGPU(t *testing.T) {
	t.Parallel()
	srv := gpuMockServer(t, http.StatusOK,
		[]container.Summary{{ID: "gpu1"}},
		map[string]any{"gpu1": nvidiaInspect("gpu1")},
	)
	_, store := datastore.MustNewTestStore(t, true, false)

	endpoint := &portainer.Endpoint{
		ID:                 21,
		Type:               portainer.DockerEnvironment,
		URL:                srv.URL,
		PostInitMigrations: portainer.EndpointPostInitMigrations{MigrateGPUs: true},
	}
	require.NoError(t, store.Endpoint().Create(endpoint))

	migrator := NewPostInitMigrator(nil, dockerClient.NewClientFactory(nil, nil), store, "", nil)
	err := migrator.MigrateEnvironment(endpoint)
	require.NoError(t, err)

	got, err := store.Endpoint().Endpoint(endpoint.ID)
	require.NoError(t, err)
	require.False(t, got.PostInitMigrations.MigrateGPUs)
	require.True(t, got.EnableGPUManagement)
}

func TestMigrateEnvironment_DockerCreateClientError(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	endpoint := &portainer.Endpoint{
		ID:   22,
		Type: portainer.DockerEnvironment,
		URL:  "tcp://127.0.0.1:2375",
		TLSConfig: portainer.TLSConfiguration{
			TLS:           true,
			TLSCACertPath: "/nonexistent/ca.pem",
			TLSCertPath:   "/nonexistent/cert.pem",
			TLSKeyPath:    "/nonexistent/key.pem",
		},
		PostInitMigrations: portainer.EndpointPostInitMigrations{MigrateGPUs: true},
	}
	require.NoError(t, store.Endpoint().Create(endpoint))

	migrator := NewPostInitMigrator(nil, dockerClient.NewClientFactory(nil, nil), store, "", nil)
	err := migrator.MigrateEnvironment(endpoint)
	require.Error(t, err)
}

func TestMigrateEnvironment_DockerMigrateGPUsError(t *testing.T) {
	t.Parallel()
	srv := gpuMockServer(t, http.StatusInternalServerError, nil, nil)
	_, store := datastore.MustNewTestStore(t, true, false)

	endpoint := &portainer.Endpoint{
		ID:                 23,
		Type:               portainer.DockerEnvironment,
		URL:                srv.URL,
		PostInitMigrations: portainer.EndpointPostInitMigrations{MigrateGPUs: true},
	}
	require.NoError(t, store.Endpoint().Create(endpoint))

	migrator := NewPostInitMigrator(nil, dockerClient.NewClientFactory(nil, nil), store, "", nil)
	err := migrator.MigrateEnvironment(endpoint)
	require.Error(t, err)
}

func TestMigrateEnvironment_NonDockerNonKubernetesReturnsNil(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	migrator := NewPostInitMigrator(nil, dockerClient.NewClientFactory(nil, nil), store, "", nil)

	err := migrator.MigrateEnvironment(&portainer.Endpoint{
		ID:   24,
		Type: portainer.AzureEnvironment,
		URL:  "https://example.invalid",
	})
	require.NoError(t, err)
}

func TestPostInitMigrate_LocalDockerRunsMigration(t *testing.T) {
	t.Parallel()
	srv := gpuMockServer(t, http.StatusOK,
		[]container.Summary{{ID: "local1"}},
		map[string]any{"local1": nvidiaInspect("local1")},
	)
	_, store := datastore.MustNewTestStore(t, true, true)

	endpoint := &portainer.Endpoint{
		ID:                 31,
		Type:               portainer.DockerEnvironment,
		URL:                srv.URL,
		PostInitMigrations: portainer.EndpointPostInitMigrations{MigrateGPUs: true},
	}
	require.NoError(t, store.Endpoint().Create(endpoint))

	migrator := NewPostInitMigrator(nil, dockerClient.NewClientFactory(nil, nil), store, "", nil)
	err := migrator.PostInitMigrate()
	require.NoError(t, err)

	got, err := store.Endpoint().Endpoint(endpoint.ID)
	require.NoError(t, err)
	require.False(t, got.PostInitMigrations.MigrateGPUs)
	require.True(t, got.EnableGPUManagement)

	pending, err := store.PendingActions().ReadAll()
	require.NoError(t, err)
	require.Empty(t, pending)
}

func TestPostInitMigrate_LocalDockerMigrationErrorIsLogged(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, true)

	endpoint := &portainer.Endpoint{
		ID:   32,
		Type: portainer.DockerEnvironment,
		URL:  "tcp://127.0.0.1:2375",
		TLSConfig: portainer.TLSConfiguration{
			TLS:           true,
			TLSCACertPath: "/nonexistent/ca.pem",
			TLSCertPath:   "/nonexistent/cert.pem",
			TLSKeyPath:    "/nonexistent/key.pem",
		},
		PostInitMigrations: portainer.EndpointPostInitMigrations{MigrateGPUs: true},
	}
	require.NoError(t, store.Endpoint().Create(endpoint))

	migrator := NewPostInitMigrator(nil, dockerClient.NewClientFactory(nil, nil), store, "", nil)
	err := migrator.PostInitMigrate()
	require.NoError(t, err)
}

func TestPostInitMigrate_SortsExistingPendingActions(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, true)

	for _, id := range []portainer.EndpointID{41, 42} {
		endpoint := &portainer.Endpoint{
			ID:          id,
			UserTrusted: true,
			Type:        portainer.EdgeAgentOnDockerEnvironment,
			Edge:        portainer.EnvironmentEdgeSettings{AsyncMode: false},
			EdgeID:      "edge",
		}
		require.NoError(t, store.Endpoint().Create(endpoint))
		require.NoError(t, store.PendingActions().Create(&portainer.PendingAction{
			EndpointID: id,
			Action:     actions.PostInitMigrateEnvironment,
		}))
	}

	migrator := NewPostInitMigrator(nil, nil, store, "", nil)
	err := migrator.PostInitMigrate()
	require.NoError(t, err)

	pending, err := store.PendingActions().ReadAll()
	require.NoError(t, err)
	require.Len(t, pending, 2)
}

func TestMigrateIngresses_SkipWhenFlagFalse(t *testing.T) {
	t.Parallel()
	migrator := &PostInitMigrator{}
	err := migrator.MigrateIngresses(portainer.Endpoint{
		ID:                 51,
		PostInitMigrations: portainer.EndpointPostInitMigrations{MigrateIngresses: false},
	}, nil)
	require.NoError(t, err)
}

func TestMigrateRegistrySASecrets_SkipWhenFlagFalse(t *testing.T) {
	t.Parallel()
	migrator := &PostInitMigrator{}
	err := migrator.MigrateRegistrySASecrets(portainer.Endpoint{
		ID:                 52,
		PostInitMigrations: portainer.EndpointPostInitMigrations{MigrateRegistrySASecrets: false},
	}, nil)
	require.NoError(t, err)
}
