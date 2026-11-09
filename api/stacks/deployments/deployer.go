package deployments

import (
	"context"
	"sync"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	dockerclient "github.com/portainer/portainer/api/docker/client"
)

type BaseStackDeployer interface {
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
	composeStackManager portainer.ComposeStackManager
	ClientFactory       *dockerclient.ClientFactory
	dataStore           dataservices.DataStore
}

// NewStackDeployer inits a stackDeployer struct with a ComposeStackManager
func NewStackDeployer(composeStackManager portainer.ComposeStackManager,
	clientFactory *dockerclient.ClientFactory, dataStore dataservices.DataStore,
) *stackDeployer {
	return &stackDeployer{
		lock:                &sync.Mutex{},
		composeStackManager: composeStackManager,
		ClientFactory:       clientFactory,
		dataStore:           dataStore,
	}
}

func (d *stackDeployer) GetDockerClientFactory() *dockerclient.ClientFactory {
	return d.ClientFactory
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
