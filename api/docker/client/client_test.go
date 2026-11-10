package client

import (
	"testing"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/pkg/fips"
	"github.com/portainer/portainer/pkg/testhelpers"

	"github.com/stretchr/testify/require"
)

func TestHttpClient(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)

	// Valid TLS configuration
	endpoint := &portainer.Endpoint{}
	endpoint.TLSConfig = portainer.TLSConfiguration{TLS: true}

	cli, err := httpClient(endpoint, nil)
	require.NoError(t, err)
	require.NotNil(t, cli)

	// Invalid TLS configuration
	endpoint.TLSConfig.TLSCertPath = "/invalid/path/client.crt"
	endpoint.TLSConfig.TLSKeyPath = "/invalid/path/client.key"

	cli, err = httpClient(endpoint, nil)
	require.Error(t, err)
	require.Nil(t, cli)
}

func TestNewClientFactory(t *testing.T) {
	t.Parallel()
	f := NewClientFactory(nil)
	require.NotNil(t, f)
	require.Nil(t, f.signatureService)
}

func TestCreateClient_LocalUnixAndTCP(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	f := NewClientFactory(nil)

	unixCli, err := f.CreateClient(&portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "unix:///var/run/docker.sock",
	}, nil)
	require.NoError(t, err)
	require.NotNil(t, unixCli)
	require.NoError(t, unixCli.Close())

	timeout := 2 * time.Second
	tcpCli, err := f.CreateClient(&portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "tcp://127.0.0.1:2375",
	}, &timeout)
	require.NoError(t, err)
	require.NotNil(t, tcpCli)
	require.NoError(t, tcpCli.Close())

	tlsCli, err := f.CreateClient(&portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "tcp://127.0.0.1:2376",
		TLSConfig: portainer.TLSConfiguration{
			TLS:           true,
			TLSSkipVerify: true,
		},
	}, nil)
	require.NoError(t, err)
	require.NotNil(t, tlsCli)
	require.NoError(t, tlsCli.Close())
}

func TestCreateClient_AzureUnsupported(t *testing.T) {
	t.Parallel()
	f := NewClientFactory(nil)
	cli, err := f.CreateClient(&portainer.Endpoint{Type: portainer.AzureEnvironment}, nil)
	require.ErrorIs(t, err, errUnsupportedEnvironmentType)
	require.Nil(t, cli)
}

func TestHttpClient_CustomTimeout(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	timeout := 3 * time.Second
	cli, err := httpClient(&portainer.Endpoint{}, &timeout)
	require.NoError(t, err)
	require.Equal(t, timeout, cli.Timeout)
}

func TestCreateClient_TCPBadTLS_ReturnsError(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	f := NewClientFactory(nil)
	cli, err := f.CreateClient(&portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "tcp://127.0.0.1:2376",
		TLSConfig: portainer.TLSConfiguration{
			TLS:         true,
			TLSCertPath: "/no/cert.pem",
			TLSKeyPath:  "/no/key.pem",
		},
	}, nil)
	require.Error(t, err)
	require.Nil(t, cli)
}

// REQ-TAI-007: the Portainer Agent is removed. A legacy Agent environment left in
// the database is refused with a clear error instead of being dialled.
func TestREQ_TAI_007_CreateClient_RefusesAgentEnvironments(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	f := NewClientFactory(testhelpers.NewStubSignatureService())

	for _, envType := range []portainer.EndpointType{portainer.AgentOnDockerEnvironment, portainer.AgentOnKubernetesEnvironment} {
		cli, err := f.CreateClient(&portainer.Endpoint{
			Type: envType,
			URL:  "tcp://127.0.0.1:9001",
		}, nil)
		require.ErrorIs(t, err, portainer.ErrAgentEnvironmentNotSupported)
		require.Nil(t, cli)
	}
}
