package factory

import (
	"net/http/httputil"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/http/proxy/factory/docker"
	"github.com/portainer/portainer/pkg/fips"
	"github.com/portainer/portainer/pkg/libhttp/ssrf"

	"github.com/stretchr/testify/require"
)

func init() {
	fips.InitFIPS(false)
}

type staticAllowListService struct {
	parsed portainer.ParsedAllowList
}

func (s *staticAllowListService) ReadParsed(id portainer.AllowListKey) (*portainer.ParsedAllowList, error) {
	return &s.parsed, nil
}

func enableSSRF(t *testing.T) {
	t.Helper()
	parsed := ssrf.ParseAllowedHosts([]string{"example.com"})
	parsed.Mode = portainer.SSRFModeEnforce
	err := ssrf.Configure(&staticAllowListService{parsed: parsed})
	require.NoError(t, err)
	t.Cleanup(func() {
		err := ssrf.Configure(&staticAllowListService{})
		require.NoError(t, err)
	})
}

func TestNewDockerHTTPProxy_NonEdgeNoTLS(t *testing.T) {
	enableSSRF(t)

	f := &ProxyFactory{}
	endpoint := &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "tcp://192.168.1.100:2376",
	}

	handler, err := f.newDockerHTTPProxy(endpoint)
	require.NoError(t, err)

	proxy := handler.(*httputil.ReverseProxy)
	dt := proxy.Transport.(*docker.Transport)
	require.NotNil(t, dt.HTTPTransport.DialContext)
}

func TestNewDockerHTTPProxy_NonEdgeTLS(t *testing.T) {
	enableSSRF(t)

	f := &ProxyFactory{}
	endpoint := &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "tcp://192.168.1.100:2376",
		TLSConfig: portainer.TLSConfiguration{
			TLS:           true,
			TLSSkipVerify: true,
		},
	}

	handler, err := f.newDockerHTTPProxy(endpoint)
	require.NoError(t, err)

	proxy := handler.(*httputil.ReverseProxy)
	dt := proxy.Transport.(*docker.Transport)
	require.NotNil(t, dt.HTTPTransport.DialContext)
}

func TestNewAgentProxy_NonEdgeNoTLS(t *testing.T) {
	f := &ProxyFactory{}
	endpoint := &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "tcp://192.168.1.100:2375",
	}

	proxyServer, err := f.NewAgentProxy(endpoint)
	require.NoError(t, err)
	defer proxyServer.Close()

	require.Positive(t, proxyServer.Port)
}

func TestNewAgentProxy_NonEdgeTLS(t *testing.T) {
	f := &ProxyFactory{}
	endpoint := &portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "tcp://192.168.1.100:2376",
		TLSConfig: portainer.TLSConfiguration{
			TLS:           true,
			TLSSkipVerify: true,
		},
	}

	proxyServer, err := f.NewAgentProxy(endpoint)
	require.NoError(t, err)
	defer proxyServer.Close()

	require.Positive(t, proxyServer.Port)
}

// REQ-TAI-004: Edge environments have no reverse tunnel any more; building a
// proxy for a legacy Edge record fails instead of dialing anything.
func TestREQ_TAI_004_EdgeEnvironmentsGetNoProxy(t *testing.T) {
	f := &ProxyFactory{}

	for _, endpointType := range []portainer.EndpointType{portainer.EdgeAgentOnDockerEnvironment, portainer.EdgeAgentOnKubernetesEnvironment} {
		endpoint := &portainer.Endpoint{Type: endpointType, URL: "tcp://192.168.1.100:9001"}

		_, err := f.NewEndpointProxy(endpoint)
		require.ErrorIs(t, err, portainer.ErrEdgeEnvironmentNotSupported)

		_, err = f.NewAgentProxy(endpoint)
		require.ErrorIs(t, err, portainer.ErrEdgeEnvironmentNotSupported)
	}

	_, err := f.newDockerHTTPProxy(&portainer.Endpoint{Type: portainer.EdgeAgentOnDockerEnvironment, URL: "tcp://192.168.1.100:2376"})
	require.ErrorIs(t, err, portainer.ErrEdgeEnvironmentNotSupported)
}

// REQ-TAI-007: the Portainer Agent is removed. A legacy Agent environment gets
// no proxy; the request is refused instead of being signed and forwarded.
func TestREQ_TAI_007_AgentEnvironmentsGetNoProxy(t *testing.T) {
	f := &ProxyFactory{}

	for _, endpointType := range []portainer.EndpointType{portainer.AgentOnDockerEnvironment, portainer.AgentOnKubernetesEnvironment} {
		endpoint := &portainer.Endpoint{Type: endpointType, URL: "tcp://192.168.1.100:9001"}

		_, err := f.NewEndpointProxy(endpoint)
		require.ErrorIs(t, err, portainer.ErrAgentEnvironmentNotSupported)

		_, err = f.NewAgentProxy(endpoint)
		require.ErrorIs(t, err, portainer.ErrAgentEnvironmentNotSupported)
	}
}

// REQ-TAI-008: a leftover Azure environment record gets no proxy; there is no
// Azure API proxy any more.
func TestREQ_TAI_008_AzureEnvironmentGetsNoProxy(t *testing.T) {
	f := &ProxyFactory{}

	_, err := f.NewEndpointProxy(&portainer.Endpoint{Type: portainer.AzureEnvironment, URL: "https://management.azure.com"})
	require.ErrorIs(t, err, portainer.ErrAzureEnvironmentNotSupported)
}

func TestREQ_TAI_016_KubernetesEnvironmentGetsNoProxy(t *testing.T) {
	f := &ProxyFactory{}

	_, err := f.NewEndpointProxy(&portainer.Endpoint{Type: portainer.KubernetesLocalEnvironment, URL: "https://kubernetes.default.svc"})
	require.ErrorIs(t, err, portainer.ErrKubernetesEnvironmentNotSupported)
}
