package handlers

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	dockerClient "github.com/portainer/portainer/api/docker/client"
	"github.com/portainer/portainer/api/internal/authorization"
	"github.com/portainer/portainer/pkg/fips"

	"github.com/docker/docker/api/types/container"
	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	fips.InitFIPS(false)
	os.Exit(m.Run())
}

func localDockerGPUServer(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/_ping" || strings.HasSuffix(r.URL.Path, "/_ping"):
			w.Header().Set("API-Version", "1.43")
			_, _ = io.WriteString(w, "OK")
		case strings.HasSuffix(r.URL.Path, "/containers/json"):
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode([]container.Summary{{ID: "gpu-ctr"}})
		case strings.Contains(r.URL.Path, "/containers/") && strings.HasSuffix(r.URL.Path, "/json"):
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(container.InspectResponse{
				ContainerJSONBase: &container.ContainerJSONBase{
					ID: "gpu-ctr",
					HostConfig: &container.HostConfig{
						Resources: container.Resources{
							DeviceRequests: []container.DeviceRequest{{Driver: "nvidia"}},
						},
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
}

func TestNewHandlerPostInitMigrateEnvironment(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	h := NewHandlerPostInitMigrateEnvironment(
		authorization.NewService(store),
		store,
		nil,
		dockerClient.NewClientFactory(nil),
		"/assets",
		nil,
	)
	require.NotNil(t, h)
}

func TestHandlerPostInitMigrateEnvironment_ExecuteLocalDocker(t *testing.T) {
	t.Parallel()
	srv := localDockerGPUServer(t)
	t.Cleanup(srv.Close)

	_, store := datastore.MustNewTestStore(t, true, false)
	endpoint := &portainer.Endpoint{
		ID:                 41,
		Type:               portainer.DockerEnvironment,
		URL:                srv.URL,
		PostInitMigrations: portainer.EndpointPostInitMigrations{MigrateGPUs: true},
	}
	require.NoError(t, store.Endpoint().Create(endpoint))

	h := NewHandlerPostInitMigrateEnvironment(
		authorization.NewService(store),
		store,
		nil,
		dockerClient.NewClientFactory(nil),
		"",
		nil,
	)
	require.NoError(t, h.Execute(portainer.PendingAction{}, endpoint))

	got, err := store.Endpoint().Endpoint(endpoint.ID)
	require.NoError(t, err)
	require.False(t, got.PostInitMigrations.MigrateGPUs)
	require.True(t, got.EnableGPUManagement)
}

func TestHandlerPostInitMigrateEnvironment_ExecuteDockerClientError(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	endpoint := &portainer.Endpoint{
		ID:   42,
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

	h := NewHandlerPostInitMigrateEnvironment(
		authorization.NewService(store),
		store,
		nil,
		dockerClient.NewClientFactory(nil),
		"",
		nil,
	)
	err := h.Execute(portainer.PendingAction{}, endpoint)
	require.Error(t, err)
	require.Contains(t, err.Error(), "failed running post-init migrations")
}

func TestHandlerPostInitMigrateEnvironment_ExecuteNonDockerNoOp(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	h := NewHandlerPostInitMigrateEnvironment(
		authorization.NewService(store),
		store,
		nil,
		dockerClient.NewClientFactory(nil),
		"",
		nil,
	)
	require.NoError(t, h.Execute(portainer.PendingAction{}, &portainer.Endpoint{
		ID:   43,
		Type: portainer.AzureEnvironment,
		URL:  "https://example.invalid",
	}))
}
