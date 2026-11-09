package client

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestAgentClientHeaders_SignsOnlyOutsideFIPSMode(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		fipsMode   bool
		nodeName   string
		wantSigned bool
	}{
		{name: "signs outside FIPS mode", fipsMode: false, wantSigned: true},
		{name: "omits the signature in FIPS mode", fipsMode: true, wantSigned: false},
		{name: "signs outside FIPS mode with a node name", fipsMode: false, nodeName: "node-1", wantSigned: true},
		{name: "omits the signature in FIPS mode with a node name", fipsMode: true, nodeName: "node-1", wantSigned: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			headers, err := agentClientHeaders(testhelpers.NewStubSignatureService(), test.nodeName, test.fipsMode)
			require.NoError(t, err)

			if test.wantSigned {
				require.Equal(t, testhelpers.StubPublicKey, headers[portainer.PortainerAgentPublicKeyHeader])
				require.Equal(t, testhelpers.StubSignature, headers[portainer.PortainerAgentSignatureHeader])
			} else {
				require.NotContains(t, headers, portainer.PortainerAgentPublicKeyHeader)
				require.NotContains(t, headers, portainer.PortainerAgentSignatureHeader)
			}

			// The target header selects a node in an agent cluster and is
			// unrelated to the signature, so it must survive FIPS mode.
			if test.nodeName == "" {
				require.NotContains(t, headers, portainer.PortainerAgentTargetHeader)
			} else {
				require.Equal(t, test.nodeName, headers[portainer.PortainerAgentTargetHeader])
			}
		})
	}
}

// In FIPS mode the signature must never be computed, not merely dropped after the
// fact, so a signature service that always fails must still yield headers.
func TestAgentClientHeaders_FIPSModeNeverCreatesSignature(t *testing.T) {
	t.Parallel()

	headers, err := agentClientHeaders(testhelpers.NewFailingSignatureService(), "node-1", true)
	require.NoError(t, err)
	require.Equal(t, map[string]string{portainer.PortainerAgentTargetHeader: "node-1"}, headers)
}

func TestAgentClientHeaders_SignatureFailurePropagatesOutsideFIPSMode(t *testing.T) {
	t.Parallel()

	headers, err := agentClientHeaders(testhelpers.NewFailingSignatureService(), "", false)
	require.Error(t, err)
	require.Nil(t, headers)
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
	}, "", nil)
	require.NoError(t, err)
	require.NotNil(t, unixCli)
	require.NoError(t, unixCli.Close())

	timeout := 2 * time.Second
	tcpCli, err := f.CreateClient(&portainer.Endpoint{
		Type: portainer.DockerEnvironment,
		URL:  "tcp://127.0.0.1:2375",
	}, "", &timeout)
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
	}, "", nil)
	require.NoError(t, err)
	require.NotNil(t, tlsCli)
	require.NoError(t, tlsCli.Close())
}

func TestCreateClient_AzureUnsupported(t *testing.T) {
	t.Parallel()
	f := NewClientFactory(nil)
	cli, err := f.CreateClient(&portainer.Endpoint{Type: portainer.AzureEnvironment}, "", nil)
	require.ErrorIs(t, err, errUnsupportedEnvironmentType)
	require.Nil(t, cli)
}

func TestCreateClient_AgentOnDocker(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	f := NewClientFactory(testhelpers.NewStubSignatureService())

	cli, err := f.CreateClient(&portainer.Endpoint{
		Type: portainer.AgentOnDockerEnvironment,
		URL:  "tcp://127.0.0.1:9001",
	}, "worker-1", nil)
	require.NoError(t, err)
	require.NotNil(t, cli)
	require.NoError(t, cli.Close())
}

func TestCreateClient_AgentSignatureFailure(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	f := NewClientFactory(testhelpers.NewFailingSignatureService())
	cli, err := f.CreateClient(&portainer.Endpoint{
		Type: portainer.AgentOnDockerEnvironment,
		URL:  "tcp://127.0.0.1:9001",
	}, "", nil)
	require.Error(t, err)
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

func TestNodeNameTransport_RoundTrip(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/images/json"):
			w.Header().Set("Content-Type", "application/json")
			body := `[{"Id":"sha256:abc","Portainer":{"Agent":{"NodeName":"node-a"}}},{"Id":"sha256:def","Portainer":{"Agent":{"NodeName":"node-b"}}}]`
			w.Header().Set("Content-Length", fmt.Sprintf("%d", len(body)))
			_, _ = w.Write([]byte(body))
		case strings.HasSuffix(r.URL.Path, "/_ping"):
			_, _ = w.Write([]byte("OK"))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)

	tr := &NodeNameTransport{Transport: http.DefaultTransport.(*http.Transport).Clone()}

	// non-images path: passthrough
	req, err := http.NewRequest(http.MethodGet, srv.URL+"/_ping", nil)
	require.NoError(t, err)
	resp, err := tr.RoundTrip(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.NoError(t, resp.Body.Close())

	// images/json with node map
	nodeNames := map[string]string{}
	req, err = http.NewRequest(http.MethodGet, srv.URL+"/images/json", nil)
	require.NoError(t, err)
	req = req.WithContext(context.WithValue(req.Context(), NodeNamesCtxKey{}, nodeNames))
	resp, err = tr.RoundTrip(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())
	require.Contains(t, string(body), "sha256:abc")
	require.Equal(t, "node-a", nodeNames["sha256:abc-0"])
	require.Equal(t, "node-b", nodeNames["sha256:def-1"])

	// images/json without node map still OK
	req, err = http.NewRequest(http.MethodGet, srv.URL+"/images/json", nil)
	require.NoError(t, err)
	resp, err = tr.RoundTrip(req)
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())

	// invalid JSON body still returns response
	badSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		body := `not-json`
		w.Header().Set("Content-Length", fmt.Sprintf("%d", len(body)))
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(badSrv.Close)
	req, err = http.NewRequest(http.MethodGet, badSrv.URL+"/images/json", nil)
	require.NoError(t, err)
	resp, err = tr.RoundTrip(req)
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())

	// transport error
	req, err = http.NewRequest(http.MethodGet, "http://127.0.0.1:1/images/json", nil)
	require.NoError(t, err)
	_, err = tr.RoundTrip(req)
	require.Error(t, err)
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
	}, "", nil)
	require.Error(t, err)
	require.Nil(t, cli)
}

func TestCreateClient_AgentTLSAndHTTPClientError(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	f := NewClientFactory(testhelpers.NewStubSignatureService())

	cli, err := f.CreateClient(&portainer.Endpoint{
		Type: portainer.AgentOnDockerEnvironment,
		URL:  "tcp://127.0.0.1:9001",
		TLSConfig: portainer.TLSConfiguration{
			TLS:           true,
			TLSSkipVerify: true,
		},
	}, "", nil)
	require.NoError(t, err)
	require.NotNil(t, cli)
	require.NoError(t, cli.Close())

	cli, err = f.CreateClient(&portainer.Endpoint{
		Type: portainer.AgentOnDockerEnvironment,
		URL:  "tcp://127.0.0.1:9001",
		TLSConfig: portainer.TLSConfiguration{
			TLS:         true,
			TLSCertPath: "/no/cert.pem",
			TLSKeyPath:  "/no/key.pem",
		},
	}, "", nil)
	require.Error(t, err)
	require.Nil(t, cli)
}
