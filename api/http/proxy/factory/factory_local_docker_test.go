package factory

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/http/proxy/factory/docker"
	"github.com/portainer/portainer/pkg/fips"

	"github.com/stretchr/testify/require"
)

func init() {
	fips.InitFIPS(false)
}

// shortUnixSock returns a short path under /tmp so AF_UNIX sun_path limits are not hit.
func shortUnixSock(t *testing.T) string {
	t.Helper()
	sock := filepath.Join("/tmp", fmt.Sprintf("pff-%d-%d.sock", os.Getpid(), time.Now().UnixNano()%1_000_000_000))
	t.Cleanup(func() { _ = os.Remove(sock) })
	return sock
}

// startUnixHTTPServer serves handler on a temporary Unix socket and returns its path.
func startUnixHTTPServer(t *testing.T, handler http.Handler) string {
	t.Helper()

	sock := shortUnixSock(t)
	ln, err := net.Listen("unix", sock)
	require.NoError(t, err)
	t.Cleanup(func() { _ = ln.Close() })

	srv := &http.Server{Handler: handler}
	go func() { _ = srv.Serve(ln) }()
	t.Cleanup(func() { _ = srv.Close() })

	return sock
}

func TestNewProxyFactory_WiresDependencies(t *testing.T) {
	t.Parallel()

	tunnel := &stubTunnelService{}
	f := NewProxyFactory(nil, nil, tunnel, nil, nil, nil, nil, nil, nil)
	require.NotNil(t, f)
	require.Same(t, tunnel, f.reverseTunnelService)
}

// TestREQ_ENV_05_NewEndpointProxy_LocalDockerUnix builds a filesystem-backed
// Docker proxy for a local unix:// endpoint (REQ-ENV-05 proxy construction).
func TestREQ_ENV_05_NewEndpointProxy_LocalDockerUnix(t *testing.T) {
	enableSSRF(t)

	var gotPath string
	sock := startUnixHTTPServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.Header().Set("X-From-Socket", "1")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"ok":true}`)
	}))

	f := NewProxyFactory(nil, nil, &stubTunnelService{}, nil, nil, nil, nil, nil, nil)
	endpoint := &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "unix://" + sock,
	}

	handler, err := f.NewEndpointProxy(endpoint)
	require.NoError(t, err)
	require.IsType(t, &dockerLocalProxy{}, handler)

	req := httptest.NewRequest(http.MethodGet, "http://example/_ping", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "1", rec.Header().Get("X-From-Socket"))
	require.JSONEq(t, `{"ok":true}`, rec.Body.String())
	require.Equal(t, "/_ping", gotPath)
	require.Equal(t, "http", req.URL.Scheme)
	require.Equal(t, "unixsocket", req.URL.Host)
}

// TestREQ_ENV_05_NewEndpointProxy_DockerTCP routes a TCP Docker endpoint to the
// HTTP reverse proxy (REQ-ENV-05).
func TestREQ_ENV_05_NewEndpointProxy_DockerTCP(t *testing.T) {
	enableSSRF(t)

	f := NewProxyFactory(nil, nil, &stubTunnelService{}, nil, nil, nil, nil, nil, nil)
	endpoint := &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "tcp://192.168.1.50:2375",
	}

	handler, err := f.NewEndpointProxy(endpoint)
	require.NoError(t, err)
	require.IsType(t, &httputil.ReverseProxy{}, handler)

	proxy := handler.(*httputil.ReverseProxy)
	require.NotNil(t, proxy.Transport)
	_, ok := proxy.Transport.(*docker.Transport)
	require.True(t, ok)
}

func TestREQ_ENV_05_NewDockerProxy_RoutesUnixAndNpipe(t *testing.T) {
	enableSSRF(t)

	f := &ProxyFactory{reverseTunnelService: &stubTunnelService{}}

	sock := startUnixHTTPServer(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	unixHandler, err := f.newDockerProxy(&portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "unix://" + sock,
	})
	require.NoError(t, err)
	require.IsType(t, &dockerLocalProxy{}, unixHandler)

	// npipe:// is the Windows local scheme; construction still builds a local proxy.
	npipeHandler, err := f.newDockerProxy(&portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "npipe:////./pipe/docker_engine",
	})
	require.NoError(t, err)
	require.IsType(t, &dockerLocalProxy{}, npipeHandler)

	tcpHandler, err := f.newDockerProxy(&portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "tcp://10.0.0.2:2375",
	})
	require.NoError(t, err)
	require.IsType(t, &httputil.ReverseProxy{}, tcpHandler)
}

func TestREQ_ENV_05_NewDockerLocalProxy_InvalidURL(t *testing.T) {
	t.Parallel()

	f := &ProxyFactory{}
	_, err := f.newDockerLocalProxy(&portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "unix://%zz",
	})
	require.Error(t, err)
}

func TestREQ_ENV_05_DockerLocalProxy_ServeHTTP_ErrorFromTransport(t *testing.T) {
	t.Parallel()

	params := &docker.TransportParameters{
		Endpoint: &portainer.Endpoint{Type: portainer.DockerEnvironment, URL: "unix:///missing.sock"},
	}
	tr, err := docker.NewTransport(params, newSocketTransport(filepath.Join("/tmp", fmt.Sprintf("pff-gone-%d.sock", os.Getpid()))), nil, nil)
	require.NoError(t, err)

	proxy := &dockerLocalProxy{transport: tr}
	req := httptest.NewRequest(http.MethodGet, "http://example/version", nil)
	rec := httptest.NewRecorder()
	proxy.ServeHTTP(rec, req)

	require.Equal(t, http.StatusInternalServerError, rec.Code)
	require.Contains(t, rec.Body.String(), "Unable to proxy the request via the Docker socket")
}

func TestREQ_ENV_05_DockerLocalProxy_ServeHTTP_CopiesHeadersAndBody(t *testing.T) {
	enableSSRF(t)

	sock := startUnixHTTPServer(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodGet, r.Method)
		require.True(t, strings.HasSuffix(r.URL.Path, "/version") || r.URL.Path == "/version")
		w.Header().Set("Content-Type", "application/json")
		w.Header().Add("X-Multi", "a")
		w.Header().Add("X-Multi", "b")
		w.WriteHeader(http.StatusCreated)
		_, _ = io.WriteString(w, `{"ApiVersion":"1.51"}`)
	}))

	params := &docker.TransportParameters{
		Endpoint: &portainer.Endpoint{Type: portainer.DockerEnvironment, URL: "unix://" + sock},
	}
	tr, err := docker.NewTransport(params, newSocketTransport(sock), nil, nil)
	require.NoError(t, err)

	proxy := &dockerLocalProxy{transport: tr}
	req := httptest.NewRequest(http.MethodGet, "http://placeholder/version", nil)
	rec := httptest.NewRecorder()
	proxy.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	require.Equal(t, "application/json", rec.Header().Get("Content-Type"))
	require.Equal(t, []string{"a", "b"}, rec.Header().Values("X-Multi"))
	require.JSONEq(t, `{"ApiVersion":"1.51"}`, rec.Body.String())
	require.Equal(t, "http", req.URL.Scheme)
	require.Equal(t, "unixsocket", req.URL.Host)
}

func TestREQ_ENV_05_NewSocketTransport_DialsUnix(t *testing.T) {
	t.Parallel()

	sock := startUnixHTTPServer(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "pong")
	}))

	transport := newSocketTransport(sock)
	require.NotNil(t, transport.DialContext)

	client := &http.Client{Transport: transport}
	resp, err := client.Get("http://unixsocket/_ping")
	require.NoError(t, err)
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Equal(t, "pong", string(body))
}

func TestNewGitlabProxy_BuildsHandler(t *testing.T) {
	t.Parallel()

	f := NewProxyFactory(nil, nil, nil, nil, nil, nil, nil, nil, nil)
	handler, err := f.NewGitlabProxy("https://gitlab.example.com/api/v4/")
	require.NoError(t, err)
	require.IsType(t, &httputil.ReverseProxy{}, handler)

	_, err = f.NewGitlabProxy("://bad")
	require.Error(t, err)
}

func TestNewSingleHostReverseProxyWithHostHeader_ErrorHandler(t *testing.T) {
	t.Parallel()

	target, err := url.Parse("http://127.0.0.1:1")
	require.NoError(t, err)

	proxy := NewSingleHostReverseProxyWithHostHeader(target)
	require.NotNil(t, proxy.ErrorHandler)

	frontend := httptest.NewServer(proxy)
	t.Cleanup(frontend.Close)

	resp, err := http.Get(frontend.URL + "/anything")
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusBadGateway, resp.StatusCode)
}

func TestSingleJoiningSlash(t *testing.T) {
	t.Parallel()

	require.Equal(t, "/a/b", singleJoiningSlash("/a/", "/b"))
	require.Equal(t, "/a/b", singleJoiningSlash("/a", "b"))
	require.Equal(t, "/a/b", singleJoiningSlash("/a", "/b"))
	require.Equal(t, "/a/b", singleJoiningSlash("/a/", "b"))
}

func TestREQ_ENV_05_NewEndpointProxy_AgentOnDockerFallsThroughToDocker(t *testing.T) {
	enableSSRF(t)

	f := NewProxyFactory(nil, nil, &stubTunnelService{}, nil, nil, nil, nil, nil, nil)
	endpoint := &portainer.Endpoint{
		Type: portainer.AgentOnDockerEnvironment,
		URL:  "tcp://192.168.1.60:9001",
	}

	handler, err := f.NewEndpointProxy(endpoint)
	require.NoError(t, err)
	require.IsType(t, &httputil.ReverseProxy{}, handler)
}

func TestREQ_ENV_05_NewDockerHTTPProxy_InvalidURL(t *testing.T) {
	t.Parallel()

	f := &ProxyFactory{reverseTunnelService: &stubTunnelService{}}
	_, err := f.newDockerHTTPProxy(&portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "tcp://%zz",
	})
	require.Error(t, err)
}

func TestREQ_ENV_05_NewDockerHTTPProxy_TLSConfigFromDiskFails(t *testing.T) {
	enableSSRF(t)

	f := &ProxyFactory{reverseTunnelService: &stubTunnelService{}}
	_, err := f.newDockerHTTPProxy(&portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "tcp://192.168.1.70:2376",
		TLSConfig: portainer.TLSConfiguration{
			TLS:           true,
			TLSCertPath:   "/no/such/cert.pem",
			TLSKeyPath:    "/no/such/key.pem",
			TLSCACertPath: "/no/such/ca.pem",
		},
	})
	require.Error(t, err)
}
