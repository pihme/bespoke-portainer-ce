package images

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/docker/docker/client"
	"github.com/stretchr/testify/require"
)

func newImagePullClient(t *testing.T, handler http.HandlerFunc) *client.Client {
	t.Helper()

	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	cli, err := client.NewClientWithOpts(
		client.WithHost(srv.URL),
		client.WithHTTPClient(http.DefaultClient),
		client.WithAPIVersionNegotiation(),
	)
	require.NoError(t, err)
	t.Cleanup(func() { _ = cli.Close() })

	return cli
}

func TestREQ_IMG_02_NewPuller(t *testing.T) {
	t.Parallel()

	cli := newImagePullClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	puller := NewPuller(cli, NewRegistryClient(nil), nil)
	require.NotNil(t, puller)
	require.Same(t, cli, puller.client)
	require.NotNil(t, puller.registryClient)
}

func TestREQ_IMG_02_Pull_WithoutRegistryAuth(t *testing.T) {
	img, err := ParseImage(ParseImageOptions{Name: "pull-cov-test/nginx:latest"})
	require.NoError(t, err)

	// Seed cache so EncodedRegistryAuth returns "authentication is disabled"
	// without touching a datastore (registry auth paths stay deferred).
	registriesCache.Set(img.Opts.Name, createNewRegistry("docker.io", "", false), 0)
	t.Cleanup(func() { registriesCache.Delete(img.Opts.Name) })

	var sawCreate bool
	cli := newImagePullClient(t, func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/images/create") || r.URL.Path == "/images/create" {
			sawCreate = true
			require.Equal(t, http.MethodPost, r.Method)
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"status":"Pulling from library/nginx"}`+"\n")
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	puller := NewPuller(cli, NewRegistryClient(nil), nil)
	require.NoError(t, puller.Pull(t.Context(), img))
	require.True(t, sawCreate)
}

func TestREQ_IMG_02_Pull_ImagePullError(t *testing.T) {
	img, err := ParseImage(ParseImageOptions{Name: "pull-cov-err/nginx:latest"})
	require.NoError(t, err)

	registriesCache.Set(img.Opts.Name, createNewRegistry("docker.io", "", false), 0)
	t.Cleanup(func() { registriesCache.Delete(img.Opts.Name) })

	cli := newImagePullClient(t, func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/images/create") {
			http.Error(w, `{"message":"pull failed"}`, http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	puller := NewPuller(cli, NewRegistryClient(nil), nil)
	require.Error(t, puller.Pull(t.Context(), img))
}
