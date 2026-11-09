package docker_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	dockerpkg "github.com/portainer/portainer/api/docker"
	dockerclient "github.com/portainer/portainer/api/docker/client"

	dockercontainer "github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/require"
)

// Force-pull needs a real DataStore (RegistryClient.ViewTx). That import cycles
// inside package docker tests, so this lives in docker_test.
func TestREQ_CTR_06_Recreate_ForcePullImage(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)

	oldID := "old-ctr"
	newID := "new-ctr"
	var sawPull bool

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case path == "/_ping" || strings.HasSuffix(path, "/_ping"):
			w.Header().Set("API-Version", "1.43")
			_, _ = w.Write([]byte("OK"))
		case strings.Contains(path, "/containers/") && strings.HasSuffix(path, "/json"):
			id := "old-ctr"
			parts := strings.Split(path, "/")
			for i, p := range parts {
				if p == "containers" && i+1 < len(parts) {
					id = parts[i+1]
					break
				}
			}
			body := map[string]any{
				"Id":   id,
				"Name": "/web",
				"HostConfig": map[string]any{},
				"Config":     map[string]any{"Image": "nginx:latest"},
				"NetworkSettings": map[string]any{
					"Networks": map[string]*network.EndpointSettings{
						"bridge": {NetworkID: "net-bridge", EndpointID: "ep-1"},
					},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(body)
		case strings.Contains(path, "/containers/") && strings.HasSuffix(path, "/stop"):
			w.WriteHeader(http.StatusNoContent)
		case strings.Contains(path, "/containers/") && strings.Contains(path, "/rename"):
			w.WriteHeader(http.StatusNoContent)
		case strings.Contains(path, "/networks/") && strings.HasSuffix(path, "/disconnect"):
			w.WriteHeader(http.StatusOK)
		case strings.HasSuffix(path, "/containers/create"):
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(dockercontainer.CreateResponse{ID: newID})
		case strings.Contains(path, "/networks/") && strings.HasSuffix(path, "/connect"):
			w.WriteHeader(http.StatusOK)
		case strings.Contains(path, "/containers/") && strings.HasSuffix(path, "/start"):
			w.WriteHeader(http.StatusNoContent)
		case r.Method == http.MethodDelete && strings.Contains(path, "/containers/"):
			w.WriteHeader(http.StatusNoContent)
		case strings.Contains(path, "/images/create"):
			sawPull = true
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"status":"Pulling"}`+"\n")
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)

	svc := dockerpkg.NewContainerService(dockerclient.NewClientFactory(nil, nil), store)
	got, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, oldID, true, "", "")
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, newID, got.ID)
	require.True(t, sawPull)
}

func TestREQ_CTR_06_Recreate_ForcePullImageError(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case path == "/_ping" || strings.HasSuffix(path, "/_ping"):
			w.Header().Set("API-Version", "1.43")
			_, _ = w.Write([]byte("OK"))
		case strings.Contains(path, "/containers/") && strings.HasSuffix(path, "/json"):
			body := map[string]any{
				"Id":   "old-ctr",
				"Name": "/web",
				"HostConfig": map[string]any{},
				"Config":     map[string]any{"Image": "nginx:latest"},
				"NetworkSettings": map[string]any{
					"Networks": map[string]*network.EndpointSettings{
						"bridge": {NetworkID: "net-bridge"},
					},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(body)
		case strings.Contains(path, "/images/create"):
			http.Error(w, `{"message":"pull failed"}`, http.StatusInternalServerError)
		default:
			w.WriteHeader(http.StatusOK)
		}
	}))
	t.Cleanup(srv.Close)

	svc := dockerpkg.NewContainerService(dockerclient.NewClientFactory(nil, nil), store)
	_, err := svc.Recreate(t.Context(), &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  srv.URL,
	}, "old-ctr", true, "", "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "pull image error")
}
