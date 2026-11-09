package docker

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	portainer "github.com/portainer/portainer/api"
	dockerclient "github.com/portainer/portainer/api/docker/client"
	"github.com/docker/docker/api/types"
	dockercontainer "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/system"
	"github.com/docker/docker/api/types/volume"
	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_12_NewSnapshotter(t *testing.T) {
	t.Parallel()

	factory := dockerclient.NewClientFactory(nil, nil)
	snapshotter := NewSnapshotter(factory)
	require.NotNil(t, snapshotter)
	require.Same(t, factory, snapshotter.clientFactory)
}

func TestREQ_ENV_12_CreateSnapshot_CreateClientError(t *testing.T) {
	t.Parallel()

	snapshotter := NewSnapshotter(dockerclient.NewClientFactory(nil, nil))
	_, err := snapshotter.CreateSnapshot(&portainer.Endpoint{
		Type: portainer.AzureEnvironment,
		URL:  "https://example.invalid",
	})
	require.Error(t, err)
}

func TestREQ_ENV_12_CreateSnapshot_LocalDockerEndpoint(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		w.Header().Set("Content-Type", "application/json")

		switch {
		case path == "/_ping" || strings.HasSuffix(path, "/_ping"):
			w.Header().Set("API-Version", "1.43")
			w.Header().Del("Content-Type")
			_, _ = w.Write([]byte("OK"))
		case strings.HasSuffix(path, "/info"):
			_ = json.NewEncoder(w).Encode(system.Info{
				ID:            "snap-engine-1",
				NCPU:          2,
				MemTotal:      1024 * 1024 * 1024,
				ServerVersion: "24.0.0",
			})
		case strings.HasSuffix(path, "/containers/json"):
			_ = json.NewEncoder(w).Encode([]dockercontainer.Summary{})
		case strings.HasSuffix(path, "/images/json"):
			_ = json.NewEncoder(w).Encode([]image.Summary{})
		case strings.HasSuffix(path, "/volumes"):
			_ = json.NewEncoder(w).Encode(volume.ListResponse{Volumes: []*volume.Volume{}})
		case strings.HasSuffix(path, "/networks"):
			_ = json.NewEncoder(w).Encode([]network.Summary{})
		case strings.HasSuffix(path, "/version"):
			_ = json.NewEncoder(w).Encode(types.Version{Version: "24.0.0", APIVersion: "1.43"})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)

	snapshotter := NewSnapshotter(dockerclient.NewClientFactory(nil, nil))
	snap, err := snapshotter.CreateSnapshot(&portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	})
	require.NoError(t, err)
	require.NotNil(t, snap)
	require.Equal(t, 1, snap.NodeCount)
	require.False(t, snap.Swarm)
}
