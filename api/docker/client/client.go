package client

import (
	"errors"
	"net/http"
	"strings"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/crypto"
	"github.com/portainer/portainer/pkg/libhttp/ssrf"

	"github.com/docker/docker/client"
)

var errUnsupportedEnvironmentType = errors.New("environment not supported")

const (
	defaultDockerRequestTimeout = 60 * time.Second
	dockerClientVersion         = "1.37"
)

// ClientFactory is used to create Docker clients
type ClientFactory struct {
	signatureService portainer.DigitalSignatureService
}

// NewClientFactory returns a new instance of a ClientFactory
func NewClientFactory(signatureService portainer.DigitalSignatureService) *ClientFactory {
	return &ClientFactory{
		signatureService: signatureService,
	}
}

// CreateClient is a generic function to create a Docker client based on
// a specific environment(endpoint) configuration.
// The underlying http client timeout may be specified, a default value is used otherwise.
// Agent environments are refused: the Agent is removed (TAI-007).
func (factory *ClientFactory) CreateClient(endpoint *portainer.Endpoint, timeout *time.Duration) (*client.Client, error) {
	switch endpoint.Type {
	case portainer.AzureEnvironment:
		return nil, errUnsupportedEnvironmentType
	case portainer.AgentOnDockerEnvironment, portainer.AgentOnKubernetesEnvironment:
		return nil, portainer.ErrAgentEnvironmentNotSupported
	case portainer.EdgeAgentOnDockerEnvironment, portainer.EdgeAgentOnKubernetesEnvironment:
		return nil, portainer.ErrEdgeEnvironmentNotSupported
	}

	if strings.HasPrefix(endpoint.URL, "unix://") || strings.HasPrefix(endpoint.URL, "npipe://") {
		return createLocalClient(endpoint)
	}

	return createTCPClient(endpoint, timeout)
}

func createLocalClient(endpoint *portainer.Endpoint) (*client.Client, error) {
	return client.NewClientWithOpts(
		client.WithHost(endpoint.URL),
		client.WithAPIVersionNegotiation(),
	)
}

func createTCPClient(endpoint *portainer.Endpoint, timeout *time.Duration) (*client.Client, error) {
	httpCli, err := httpClient(endpoint, timeout)
	if err != nil {
		return nil, err
	}

	opts := []client.Opt{
		client.WithHost(endpoint.URL),
		client.WithAPIVersionNegotiation(),
		client.WithHTTPClient(httpCli),
	}

	if endpoint.TLSConfig.TLS {
		opts = append(opts, client.WithScheme("https"))
	}

	return client.NewClientWithOpts(opts...)
}

func httpClient(endpoint *portainer.Endpoint, timeout *time.Duration) (*http.Client, error) {
	var transport *http.Transport
	if endpoint.TLSConfig.TLS {
		tlsConfig, err := crypto.CreateTLSConfigurationFromDisk(endpoint.TLSConfig)
		if err != nil {
			return nil, err
		}

		t := ssrf.NewTransport(tlsConfig)
		t.Protocols = ssrf.HTTP1Only()
		transport = t
	} else {
		transport = ssrf.NewTransport(nil)
	}

	clientTimeout := defaultDockerRequestTimeout
	if timeout != nil {
		clientTimeout = *timeout
	}

	return &http.Client{
		Transport: transport,
		Timeout:   clientTimeout,
	}, nil
}
