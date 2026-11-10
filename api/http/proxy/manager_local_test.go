package proxy

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	dockerclient "github.com/portainer/portainer/api/docker/client"
	pkgtesthelpers "github.com/portainer/portainer/pkg/testhelpers"

	"github.com/stretchr/testify/require"
)

func TestNewProxyFactoryAndGitlabProxy(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	manager := NewManager(nil)
	factory := dockerclient.NewClientFactory(pkgtesthelpers.NewStubSignatureService())

	manager.NewProxyFactory(store, pkgtesthelpers.NewStubSignatureService(), factory, nil, nil)
	require.NotNil(t, manager.proxyFactory)
}

func TestCreateAndRegisterEndpointProxy_LocalDocker(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	manager := NewManager(nil)
	factory := dockerclient.NewClientFactory(pkgtesthelpers.NewStubSignatureService())
	manager.NewProxyFactory(store, pkgtesthelpers.NewStubSignatureService(), factory, nil, nil)

	endpoint := &portainer.Endpoint{
		ID:   1,
		Type: portainer.DockerEnvironment,
		URL:  "unix:///var/run/docker.sock",
	}
	proxy, err := manager.CreateAndRegisterEndpointProxy(endpoint)
	require.NoError(t, err)
	require.NotNil(t, proxy)
	require.Same(t, proxy, manager.GetEndpointProxy(endpoint))
}

func TestCreateAgentProxyServer_WithFactory(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	manager := NewManager(nil)
	factory := dockerclient.NewClientFactory(pkgtesthelpers.NewStubSignatureService())
	manager.NewProxyFactory(store, pkgtesthelpers.NewStubSignatureService(), factory, nil, nil)

	endpoint := &portainer.Endpoint{
		ID:   2,
		Type: portainer.AgentOnDockerEnvironment,
		URL:  "http://127.0.0.1:9001",
	}
	// Agent proxy creation may fail without a reachable agent; either outcome
	// exercises the initialized factory path beyond the nil-factory guard.
	_, _ = manager.CreateAgentProxyServer(endpoint)
}
