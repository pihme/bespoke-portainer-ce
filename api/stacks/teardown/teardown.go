// Package teardown removes a stack's deployed resources, database records,
// and project files.
package teardown

import (
	"context"
	"fmt"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/stacks/deployments"
	"github.com/portainer/portainer/api/stacks/stackutils"

	"github.com/rs/zerolog/log"
)

// Service manages stack teardown.
//
// A full teardown calls the methods in order: RemoveResources, then
// DeleteRecords inside the caller's write transaction, then RemoveFiles once
// the transaction has committed.
type Service interface {
	// RemoveResources removes the deployed Docker/Kubernetes resources for a
	// stack.
	RemoveResources(ctx context.Context, userID portainer.UserID, stack *portainer.Stack, endpoint *portainer.Endpoint) error

	// DeleteRecords removes the stack's database records — its stack record
	// and its resource control.
	DeleteRecords(tx dataservices.DataStoreTx, stack *portainer.Stack) error

	// RemoveFiles removes the stack's project files from disk.
	RemoveFiles(stack *portainer.Stack) error
}

type service struct {
	fileService         portainer.FileService
	composeStackManager portainer.ComposeStackManager
	stackDeployer       deployments.StackDeployer
}

// NewService creates a stack teardown service.
func NewService(
	fileService portainer.FileService,
	composeStackManager portainer.ComposeStackManager,
	stackDeployer deployments.StackDeployer,
) Service {
	return &service{
		fileService:         fileService,
		composeStackManager: composeStackManager,
		stackDeployer:       stackDeployer,
	}
}

func (s *service) RemoveResources(ctx context.Context, userID portainer.UserID, stack *portainer.Stack, endpoint *portainer.Endpoint) error {
	switch stack.Type {
	case portainer.DockerSwarmStack:
		// Docker Swarm is removed (TAI-003): only the leftover stack record and
		// files are removed; the Swarm services stay in place.
		log.Warn().Int("stack_id", int(stack.ID)).Msg("Docker Swarm is no longer supported; leaving the stack's Swarm services in place")

		return nil

	case portainer.DockerComposeStack:
		stack.Name = s.composeStackManager.NormalizeStackName(stack.Name)

		if stackutils.IsRelativePathStack(stack) {
			return s.stackDeployer.UndeployRemoteComposeStack(ctx, userID, stack, endpoint)
		}

		return s.stackDeployer.UndeployComposeStack(ctx, stack, endpoint)

	case portainer.KubernetesStack:
		// Kubernetes is removed (TAI-002): Portainer can no longer reach the
		// cluster, so only the leftover stack record and files are removed.
		log.Warn().Int("stack_id", int(stack.ID)).Msg("Kubernetes is no longer supported; leaving the stack's cluster resources in place")

		return nil

	default:
		return fmt.Errorf("unsupported stack type: %v", stack.Type)
	}
}

func (s *service) DeleteRecords(tx dataservices.DataStoreTx, stack *portainer.Stack) error {
	resourceControl, err := tx.ResourceControl().ResourceControlByResourceIDAndType(stackutils.ResourceControlID(stack.EndpointID, stack.Name), portainer.StackResourceControl)
	if err != nil {
		return fmt.Errorf("unable to retrieve the resource control associated to the stack: %w", err)
	}

	if err := tx.Stack().Delete(stack.ID); err != nil {
		return fmt.Errorf("unable to remove the stack from the database: %w", err)
	}

	if resourceControl != nil {
		if err := tx.ResourceControl().Delete(resourceControl.ID); err != nil {
			return fmt.Errorf("unable to remove the associated resource control from the database: %w", err)
		}
	}

	return nil
}

func (s *service) RemoveFiles(stack *portainer.Stack) error {
	if err := s.fileService.RemoveDirectory(stack.ProjectPath); err != nil {
		return fmt.Errorf("unable to remove stack files from disk: %w", err)
	}

	return nil
}
