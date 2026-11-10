package testhelpers

import (
	"context"

	portainer "github.com/portainer/portainer/api"
	dockerclient "github.com/portainer/portainer/api/docker/client"
)

type TestStackDeployer struct {
	DeployComposeCallCount int
	LastPrune              bool
}

func NewTestStackDeployer() *TestStackDeployer {
	return &TestStackDeployer{}
}

func (d *TestStackDeployer) GetDockerClientFactory() *dockerclient.ClientFactory {
	return nil
}

func (d *TestStackDeployer) DeployComposeStack(_ context.Context, stack *portainer.Stack, endpoint *portainer.Endpoint, prune, forcePullImage, forceRecreate bool) error {
	d.DeployComposeCallCount++
	d.LastPrune = prune
	return nil
}

func (d *TestStackDeployer) UndeployComposeStack(ctx context.Context, stack *portainer.Stack, endpoint *portainer.Endpoint) error {
	return nil
}

func (d *TestStackDeployer) DeployRemoteComposeStack(_ context.Context, userId portainer.UserID, stack *portainer.Stack, endpoint *portainer.Endpoint, prune, forcePullImage, forceRecreate bool) error {
	return nil
}

func (d *TestStackDeployer) UndeployRemoteComposeStack(_ context.Context, userId portainer.UserID, stack *portainer.Stack, endpoint *portainer.Endpoint) error {
	return nil
}

func (d *TestStackDeployer) StartRemoteComposeStack(_ context.Context, userId portainer.UserID, stack *portainer.Stack, endpoint *portainer.Endpoint) error {
	return nil
}

func (d *TestStackDeployer) StopRemoteComposeStack(_ context.Context, userId portainer.UserID, stack *portainer.Stack, endpoint *portainer.Endpoint) error {
	return nil
}
