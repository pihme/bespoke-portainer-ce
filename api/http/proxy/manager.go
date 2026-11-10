package proxy

import (
	"errors"
	"net/http"
	"strconv"
	"sync"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	dockerclient "github.com/portainer/portainer/api/docker/client"
	"github.com/portainer/portainer/api/http/proxy/factory"
)

var ErrProxyFactoryNotInitialized = errors.New("proxy factory not initialized")

// Manager represents a service used to manage proxies to environments (endpoints) and extensions.
type Manager struct {
	proxyFactory    *factory.ProxyFactory
	endpointProxies sync.Map
}

// NewManager initializes a new proxy Service
func NewManager() *Manager {
	return &Manager{}
}

func (manager *Manager) NewProxyFactory(dataStore dataservices.DataStore, signatureService portainer.DigitalSignatureService, clientFactory *dockerclient.ClientFactory, gitService portainer.GitService, snapshotService portainer.SnapshotService) {
	manager.proxyFactory = factory.NewProxyFactory(dataStore, signatureService, clientFactory, gitService, snapshotService)
}

// CreateAndRegisterEndpointProxy creates a new HTTP reverse proxy based on environment(endpoint) properties and adds it to the registered proxies.
// It can also be used to create a new HTTP reverse proxy and replace an already registered proxy.
func (manager *Manager) CreateAndRegisterEndpointProxy(endpoint *portainer.Endpoint) (http.Handler, error) {
	if manager.proxyFactory == nil {
		return nil, ErrProxyFactoryNotInitialized
	}

	proxy, err := manager.proxyFactory.NewEndpointProxy(endpoint)
	if err != nil {
		return nil, err
	}

	manager.endpointProxies.Store(strconv.Itoa(int(endpoint.ID)), proxy)

	return proxy, nil
}

// CreateAgentProxyServer creates a new HTTP reverse proxy based on environment(endpoint) properties and and adds it to the registered proxies.
// It can also be used to create a new HTTP reverse proxy and replace an already registered proxy.
func (manager *Manager) CreateAgentProxyServer(endpoint *portainer.Endpoint) (*factory.ProxyServer, error) {
	if manager.proxyFactory == nil {
		return nil, ErrProxyFactoryNotInitialized
	}

	return manager.proxyFactory.NewAgentProxy(endpoint)
}

// GetEndpointProxy returns the proxy associated to a key
func (manager *Manager) GetEndpointProxy(endpoint *portainer.Endpoint) http.Handler {
	proxy, ok := manager.endpointProxies.Load(strconv.Itoa(int(endpoint.ID)))
	if !ok {
		return nil
	}

	return proxy.(http.Handler)
}

// DeleteEndpointProxy deletes the proxy associated to a key. It is called
// when an environment is updated or deleted.
func (manager *Manager) DeleteEndpointProxy(endpointID portainer.EndpointID) {
	manager.endpointProxies.Delete(strconv.Itoa(int(endpointID)))
}
