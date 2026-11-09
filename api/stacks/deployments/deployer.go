package deployments

import (
	"context"
	"sync"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	dockerclient "github.com/portainer/portainer/api/docker/client"
)

type BaseStackDeployer interface {
	DeploySwarmStack(ctx context.Context, stack *portainer.Stack, endpoint *portainer.Endpoint, registries []portainer.Registry, prune, pullImage bool) error
	DeployComposeStack(ctx context.Context, stack *portainer.Stack, endpoint *portainer.Endpoint, registries []portainer.Registry, prune, forcePullImage, forceRecreate bool) error
	UndeployComposeStack(ctx context.Context, stack *portainer.Stack, endpoint *portainer.Endpoint) error
	GetDockerClientFactory() *dockerclient.ClientFactory
}

type StackDeployer interface {
	BaseStackDeployer
	RemoteStackDeployer
}

type stackDeployer struct {
	lock                *sync.Mutex
	swarmStackManager   portainer.SwarmStackManager
	composeStackManager portainer.ComposeStackManager
	ClientFactory       *dockerclient.ClientFactory
	dataStore           dataservices.DataStore
}

// NewStackDeployer inits a stackDeployer struct with a SwarmStackManager and a ComposeStackManager
func NewStackDeployer(swarmStackManager portainer.SwarmStackManager, composeStackManager portainer.ComposeStackManager,
	clientFactory *dockerclient.ClientFactory, dataStore dataservices.DataStore,
) *stackDeployer {
	return &stackDeployer{
		lock:                &sync.Mutex{},
		swarmStackManager:   swarmStackManager,
		composeStackManager: composeStackManager,
		ClientFactory:       clientFactory,
		dataStore:           dataStore,
	}
}

func (d *stackDeployer) GetDockerClientFactory() *dockerclient.ClientFactory {
	return d.ClientFactory
}

func (d *stackDeployer) DeploySwarmStack(ctx context.Context, stack *portainer.Stack, endpoint *portainer.Endpoint, registries []portainer.Registry, prune, pullImage bool) error {
	d.lock.Lock()
	defer d.lock.Unlock()

	return d.swarmStackManager.Deploy(ctx, stack, prune, pullImage, endpoint, registries)
}

func (d *stackDeployer) DeployComposeStack(ctx context.Context, stack *portainer.Stack, endpoint *portainer.Endpoint, registries []portainer.Registry, prune, forcePullImage, forceRecreate bool) error {
	d.lock.Lock()
	defer d.lock.Unlock()

	options := portainer.ComposeOptions{Registries: registries}

	// --force-recreate doesn't pull updated images
	if forcePullImage {
		if err := d.composeStackManager.Pull(ctx, stack, endpoint, options); err != nil {
			return err
		}
	}

	return d.composeStackManager.Up(ctx, stack, endpoint, portainer.ComposeUpOptions{
		ComposeOptions: options,
		ForceRecreate:  forceRecreate,
		Prune:          prune,
	})
}

func (d *stackDeployer) UndeployComposeStack(ctx context.Context, stack *portainer.Stack, endpoint *portainer.Endpoint) error {
	d.lock.Lock()
	defer d.lock.Unlock()

	return d.composeStackManager.Down(ctx, stack, endpoint)
}
