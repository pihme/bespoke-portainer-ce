package images

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	dockerclient "github.com/portainer/portainer/api/docker/client"
	"github.com/portainer/portainer/api/http/middlewares"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/pkg/fips"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	fips.InitFIPS(false)
	os.Exit(m.Run())
}

type imagesFixture struct {
	images     []image.Summary
	containers []container.Summary
	failImages bool
	failCtrs   bool
}

func newImagesDockerServer(t *testing.T, fx *imagesFixture) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case path == "/_ping" || strings.HasSuffix(path, "/_ping"):
			w.Header().Set("API-Version", "1.43")
			_, _ = io.WriteString(w, "OK")
		case strings.HasSuffix(path, "/images/json"):
			if fx.failImages {
				http.Error(w, "boom", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(fx.images)
		case strings.HasSuffix(path, "/containers/json"):
			if fx.failCtrs {
				http.Error(w, "boom", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(fx.containers)
		default:
			http.NotFound(w, r)
		}
	}))
}

func newImagesHandlerUnderTest(t *testing.T, endpointURL string, bouncer security.BouncerService) (*mux.Router, *Handler) {
	t.Helper()
	if bouncer == nil {
		bouncer = testhelpers.NewTestRequestBouncer()
	}
	_, store := datastore.MustNewTestStore(t, true, true)
	endpoint := &portainer.Endpoint{
		ID:   1,
		Name: "local-docker",
		Type: portainer.DockerEnvironment,
		URL:  endpointURL,
	}
	require.NoError(t, store.Endpoint().Create(endpoint))

	h := NewHandler("/docker/{id}/images", bouncer, dockerclient.NewClientFactory(nil))
	root := mux.NewRouter()
	sub := root.PathPrefix("/docker/{id}").Subrouter()
	sub.Use(middlewares.WithEndpoint(store.Endpoint(), "id"))
	sub.PathPrefix("/images").Handler(h)
	return root, h
}

func TestNewHandler_RegistersImagesListRoute(t *testing.T) {
	t.Parallel()
	_, h := newImagesHandlerUnderTest(t, "tcp://127.0.0.1:1", nil)
	req := httptest.NewRequest(http.MethodGet, "/docker/1/images", nil)
	var match mux.RouteMatch
	require.True(t, h.Match(req, &match))
}

func TestImagesList_WithUsageMarksUsedImages(t *testing.T) {
	t.Parallel()
	fx := &imagesFixture{
		images: []image.Summary{
			{ID: "sha256:aaa", Created: 100, Size: 10, RepoTags: []string{"nginx:latest"}},
			{ID: "sha256:bbb", Created: 200, Size: 20, RepoDigests: []string{"busybox@sha256:digest"}},
		},
		containers: []container.Summary{
			{ID: "ctr1", ImageID: "sha256:aaa"},
		},
	}
	srv := newImagesDockerServer(t, fx)
	t.Cleanup(srv.Close)

	root, _ := newImagesHandlerUnderTest(t, srv.URL, nil)
	req := httptest.NewRequest(http.MethodGet, "/docker/1/images?withUsage=true", nil)
	rr := httptest.NewRecorder()
	root.ServeHTTP(rr, req)
	require.Equal(t, http.StatusOK, rr.Code)

	var got []ImageResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	require.Len(t, got, 2)
	require.Equal(t, "sha256:aaa", got[0].ID)
	require.True(t, got[0].Used)
	require.Equal(t, []string{"nginx:latest"}, got[0].Tags)
	require.Equal(t, "sha256:bbb", got[1].ID)
	require.False(t, got[1].Used)
	require.Equal(t, []string{"busybox:<none>"}, got[1].Tags)
}

func TestImagesList_WithoutUsageSkipsContainerLookup(t *testing.T) {
	t.Parallel()
	fx := &imagesFixture{
		images: []image.Summary{
			{ID: "sha256:ccc", Created: 1, Size: 5, RepoTags: []string{"alpine:3"}},
		},
		failCtrs: true, // would fail if containers were listed
	}
	srv := newImagesDockerServer(t, fx)
	t.Cleanup(srv.Close)

	root, _ := newImagesHandlerUnderTest(t, srv.URL, nil)
	req := httptest.NewRequest(http.MethodGet, "/docker/1/images?withUsage=false", nil)
	rr := httptest.NewRecorder()
	root.ServeHTTP(rr, req)
	require.Equal(t, http.StatusOK, rr.Code)

	var got []ImageResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	require.Len(t, got, 1)
	require.False(t, got[0].Used)
}

func TestImagesList_ImageListError(t *testing.T) {
	t.Parallel()
	srv := newImagesDockerServer(t, &imagesFixture{failImages: true})
	t.Cleanup(srv.Close)

	root, _ := newImagesHandlerUnderTest(t, srv.URL, nil)
	req := httptest.NewRequest(http.MethodGet, "/docker/1/images", nil)
	rr := httptest.NewRecorder()
	root.ServeHTTP(rr, req)
	require.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestImagesList_ContainerListErrorWithUsage(t *testing.T) {
	t.Parallel()
	srv := newImagesDockerServer(t, &imagesFixture{
		images:   []image.Summary{{ID: "sha256:ddd", RepoTags: []string{"x:1"}}},
		failCtrs: true,
	})
	t.Cleanup(srv.Close)

	root, _ := newImagesHandlerUnderTest(t, srv.URL, nil)
	req := httptest.NewRequest(http.MethodGet, "/docker/1/images?withUsage=true", nil)
	rr := httptest.NewRecorder()
	root.ServeHTTP(rr, req)
	require.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestImagesList_DefaultWithUsageWhenOmitted(t *testing.T) {
	t.Parallel()
	fx := &imagesFixture{
		images: []image.Summary{{ID: "sha256:eee", Created: 3, Size: 7, RepoTags: []string{"y:1"}}},
		containers: []container.Summary{{ID: "c", ImageID: "sha256:eee"}},
	}
	srv := newImagesDockerServer(t, fx)
	t.Cleanup(srv.Close)

	root, _ := newImagesHandlerUnderTest(t, srv.URL, nil)
	// withUsage is optional; omitted defaults through RetrieveBooleanQueryParameter(..., true)
	// to false, so containers are not listed and Used stays false.
	req := httptest.NewRequest(http.MethodGet, "/docker/1/images", nil)
	rr := httptest.NewRecorder()
	root.ServeHTTP(rr, req)
	require.Equal(t, http.StatusOK, rr.Code)

	var got []ImageResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	require.Len(t, got, 1)
	require.False(t, got[0].Used)
}

func TestImagesList_MissingEndpoint(t *testing.T) {
	t.Parallel()
	bouncer := testhelpers.NewTestRequestBouncer()
	h := NewHandler("/docker/{id}/images", bouncer, dockerclient.NewClientFactory(nil))
	root := mux.NewRouter()
	root.PathPrefix("/docker/{id}/images").Handler(h)

	req := httptest.NewRequest(http.MethodGet, "/docker/1/images", nil)
	rr := httptest.NewRecorder()
	root.ServeHTTP(rr, req)
	require.Equal(t, http.StatusNotFound, rr.Code)
}
