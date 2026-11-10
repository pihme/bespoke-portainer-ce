package factory

import (
	"net/http"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	dockerclient "github.com/portainer/portainer/api/docker/client"
)

type (
	// ProxyFactory is a factory to create reverse proxies
	ProxyFactory struct {
		dataStore           dataservices.DataStore
		signatureService    portainer.DigitalSignatureService
		dockerClientFactory *dockerclient.ClientFactory
		gitService          portainer.GitService
		snapshotService     portainer.SnapshotService
	}
)

// NewProxyFactory returns a pointer to a new instance of a ProxyFactory
func NewProxyFactory(dataStore dataservices.DataStore, signatureService portainer.DigitalSignatureService, clientFactory *dockerclient.ClientFactory, gitService portainer.GitService, snapshotService portainer.SnapshotService) *ProxyFactory {
	return &ProxyFactory{
		dataStore:           dataStore,
		signatureService:    signatureService,
		dockerClientFactory: clientFactory,
		gitService:          gitService,
		snapshotService:     snapshotService,
	}
}

// NewEndpointProxy returns a new reverse proxy (filesystem based or HTTP) to an environment(endpoint) API server
func (factory *ProxyFactory) NewEndpointProxy(endpoint *portainer.Endpoint) (http.Handler, error) {
	switch endpoint.Type {
	case portainer.AzureEnvironment:
		return nil, portainer.ErrAzureEnvironmentNotSupported
	case portainer.EdgeAgentOnDockerEnvironment, portainer.EdgeAgentOnKubernetesEnvironment:
		return nil, portainer.ErrEdgeEnvironmentNotSupported
	case portainer.AgentOnDockerEnvironment, portainer.AgentOnKubernetesEnvironment:
		return nil, portainer.ErrAgentEnvironmentNotSupported
	case portainer.KubernetesLocalEnvironment:
		return nil, portainer.ErrKubernetesEnvironmentNotSupported
	}

	return factory.newDockerProxy(endpoint)
}
