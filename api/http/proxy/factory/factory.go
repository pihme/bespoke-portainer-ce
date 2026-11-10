package factory

import (
	"net/http"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	dockerclient "github.com/portainer/portainer/api/docker/client"
	"github.com/portainer/portainer/api/http/proxy/factory/kubernetes"

	"github.com/portainer/portainer/api/kubernetes/cli"
)

type (
	// ProxyFactory is a factory to create reverse proxies
	ProxyFactory struct {
		dataStore                   dataservices.DataStore
		signatureService            portainer.DigitalSignatureService
		dockerClientFactory         *dockerclient.ClientFactory
		kubernetesClientFactory     *cli.ClientFactory
		kubernetesTokenCacheManager *kubernetes.TokenCacheManager
		gitService                  portainer.GitService
		snapshotService             portainer.SnapshotService
		jwtService                  portainer.JWTService
	}
)

// NewProxyFactory returns a pointer to a new instance of a ProxyFactory
func NewProxyFactory(dataStore dataservices.DataStore, signatureService portainer.DigitalSignatureService, clientFactory *dockerclient.ClientFactory, kubernetesClientFactory *cli.ClientFactory, kubernetesTokenCacheManager *kubernetes.TokenCacheManager, gitService portainer.GitService, snapshotService portainer.SnapshotService, jwtService portainer.JWTService) *ProxyFactory {
	return &ProxyFactory{
		dataStore:                   dataStore,
		signatureService:            signatureService,
		dockerClientFactory:         clientFactory,
		kubernetesClientFactory:     kubernetesClientFactory,
		kubernetesTokenCacheManager: kubernetesTokenCacheManager,
		gitService:                  gitService,
		snapshotService:             snapshotService,
		jwtService:                  jwtService,
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
		return factory.newKubernetesProxy(endpoint)
	}

	return factory.newDockerProxy(endpoint)
}
