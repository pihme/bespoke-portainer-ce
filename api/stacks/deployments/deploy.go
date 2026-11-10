package deployments

import (
	"cmp"
	"context"
	"fmt"
	"strconv"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/source"
	"github.com/portainer/portainer/api/git/update"
	"github.com/portainer/portainer/api/gitops/workflows"
	"github.com/portainer/portainer/api/scheduler"
	"github.com/portainer/portainer/api/stacks/stackutils"

	"github.com/pkg/errors"
	"github.com/rs/zerolog/log"
	"golang.org/x/sync/singleflight"
)

type StackAuthorMissingErr struct {
	stackID    int
	authorName string
}

func (e *StackAuthorMissingErr) Error() string {
	return fmt.Sprintf("stack's %v author %s is missing", e.stackID, e.authorName)
}

var singleflightGroup = &singleflight.Group{}

// RedeployWhenChanged pull and redeploy the stack when git repo changed
// Stack will always be redeployed if force deployment is set to true
func RedeployWhenChanged(ctx context.Context, stackID portainer.StackID, deployer StackDeployer, datastore dataservices.DataStore, gitService portainer.GitService, fileService portainer.FileService) error {
	stack, err := datastore.Stack().Read(stackID)
	if dataservices.IsErrObjectNotFound(err) {
		return scheduler.NewPermanentError(errors.WithMessagef(err, "failed to get the stack %v", stackID))
	} else if err != nil {
		return errors.WithMessagef(err, "failed to get the stack %v", stackID)
	}

	if stack.Status == portainer.StackStatusInactive {
		return nil
	}

	// Webhook
	if stack.AutoUpdate != nil && stack.AutoUpdate.Webhook != "" {
		return redeployWhenChanged(ctx, stack, deployer, datastore, gitService, fileService, true)
	}

	// Polling
	_, err, _ = singleflightGroup.Do(strconv.Itoa(int(stackID)), func() (any, error) {
		return nil, redeployWhenChanged(ctx, stack, deployer, datastore, gitService, fileService, false)
	})

	return err
}

func redeployWhenChanged(ctx context.Context, stack *portainer.Stack, deployer StackDeployer, datastore dataservices.DataStore, gitService portainer.GitService, fileService portainer.FileService, webhook bool) error {
	log.Debug().Int("stack_id", int(stack.ID)).Msg("redeploying stack")

	if stack.WorkflowID == 0 {
		return nil // do nothing if it isn't a git-based stack
	}

	endpoint, err := datastore.Endpoint().Endpoint(stack.EndpointID)
	if dataservices.IsErrObjectNotFound(err) {
		return scheduler.NewPermanentError(
			errors.WithMessagef(err,
				"failed to find the environment %v associated to the stack %v",
				stack.EndpointID,
				stack.ID,
			),
		)
	} else if err != nil {
		return errors.WithMessagef(err, "failed to find the environment %v associated to the stack %v", stack.EndpointID, stack.ID)
	}

	author := cmp.Or(stack.UpdatedBy, stack.CreatedBy)

	user, err := datastore.User().UserByUsername(author)
	if err != nil {
		log.Warn().
			Int("stack_id", int(stack.ID)).
			Str("stack", stack.Name).
			Str("author", author).
			Int("endpoint_id", int(stack.EndpointID)).
			Msg("cannot auto update a stack, stack author user is missing")

		return &StackAuthorMissingErr{int(stack.ID), author}
	}

	if !isEnvironmentOnline(endpoint) {
		return nil
	}

	if webhook {
		go func() {
			if err := redeployWhenChangedSecondStage(ctx, stack, deployer, datastore, gitService, fileService, user, endpoint); err != nil {
				log.Error().Err(err).
					Int("stack_id", int(stack.ID)).
					Str("stack", stack.Name).
					Str("author", author).
					Int("endpoint_id", int(stack.EndpointID)).
					Msg("webhook failed to redeploy a stack")
			}
		}()

		return nil
	}

	return redeployWhenChangedSecondStage(ctx, stack, deployer, datastore, gitService, fileService, user, endpoint)
}

func redeployWhenChangedSecondStage(
	ctx context.Context,
	stack *portainer.Stack,
	deployer StackDeployer,
	datastore dataservices.DataStore,
	gitService portainer.GitService,
	fileService portainer.FileService,
	user *portainer.User,
	endpoint *portainer.Endpoint,
) error {
	// There are no team memberships (TAI-023).
	userContext := source.NewUserContext(user, []portainer.TeamMembership{})
	gitSrc, file, err := workflows.GitSourceAndArtifactForStack(datastore, userContext, stack.WorkflowID, stack.ID)
	if err != nil {
		return errors.WithMessagef(err, "failed to load git config for stack %v", stack.ID)
	}

	if gitSrc == nil {
		return nil
	}

	gitConfig := workflows.MergeSourceAndFile(gitSrc, file)

	var gitCommitChangedOrForceUpdate bool

	if !stack.FromAppTemplate {
		updated, newHash, err := update.UpdateGitObject(ctx, gitService, fmt.Sprintf("stack:%d", stack.ID), gitConfig, false, stack.ProjectPath)
		if err != nil {
			if txErr := datastore.UpdateTx(func(tx dataservices.DataStoreTx) error {
				return workflows.SaveStackStatus(tx, userContext, stack.WorkflowID, stack.ID, gitSrc.ID, err)
			}); txErr != nil {
				return fmt.Errorf("git check failed for stack %d: %w (and failed to persist status: %w)", stack.ID, err, txErr)
			}

			return err
		}

		if txErr := datastore.UpdateTx(func(tx dataservices.DataStoreTx) error {
			return workflows.SaveStackStatus(tx, userContext, stack.WorkflowID, stack.ID, gitSrc.ID, nil)
		}); txErr != nil {
			return fmt.Errorf("failed to persist git sync status for stack %d: %w", stack.ID, txErr)
		}

		if updated {
			gitConfig.ConfigHash = newHash

			stack.UpdateDate = time.Now().Unix()
			gitCommitChangedOrForceUpdate = updated
		}

		if stack.AutoUpdate != nil && stack.AutoUpdate.ForceUpdate {
			gitCommitChangedOrForceUpdate = true
		}
	}

	if !gitCommitChangedOrForceUpdate {
		return nil
	}

	if err := datastore.UpdateTx(func(tx dataservices.DataStoreTx) error {
		stackutils.PrepareStackStatusForDeployment(stack)
		return tx.Stack().Update(stack.ID, stack)
	}); err != nil {
		return errors.WithMessagef(err, "failed to set the deploying status for stack %v", stack.ID)
	}

	previousDeploymentInfo := stack.CurrentDeploymentInfo

	stack.CurrentDeploymentInfo = &portainer.StackDeploymentInfo{
		RepositoryURL:   gitConfig.URL,
		ReferenceName:   gitConfig.ReferenceName,
		ConfigFilePath:  gitConfig.ConfigFilePath,
		AdditionalFiles: stack.AdditionalFiles,
		ConfigHash:      gitConfig.ConfigHash,
		SourceID:        gitSrc.ID,
	}

	redeployStack := func(stack *portainer.Stack) error {
		var err error

		if err := ValidateStackForUser(stack, endpoint, user, deployer, fileService); err != nil {
			return err
		}
		switch stack.Type {
		case portainer.DockerComposeStack:
			if stackutils.IsRelativePathStack(stack) {
				err = deployer.DeployRemoteComposeStack(ctx, user.ID, stack, endpoint, true, true, false)
			} else {
				err = deployer.DeployComposeStack(ctx, stack, endpoint, true, true, false)
			}

			if err != nil {
				return errors.WithMessagef(err, "failed to deploy a docker compose stack %v", stack.ID)
			}
		default:
			return errors.Errorf("cannot update stack, type %v is unsupported", stack.Type)
		}

		return nil
	}

	deployErr := redeployStack(stack)
	if deployErr != nil {
		stack.CurrentDeploymentInfo = previousDeploymentInfo
	}

	if err := datastore.UpdateTx(func(tx dataservices.DataStoreTx) error {
		stack.UpdateDate = time.Now().Unix()

		stackutils.UpdateStackStatusFromDeploymentResult(stack, deployErr)
		if err := tx.Stack().Update(stack.ID, stack); err != nil {
			return err
		}

		if deployErr != nil {
			return nil
		}

		newHash := gitConfig.ConfigHash

		return workflows.UpdateArtifactFileForStack(tx, stack.WorkflowID, stack.ID, gitSrc.ID, func(a *portainer.ArtifactFile) {
			a.Hash = newHash
			a.RefStatus = portainer.SourceStatusHealthy
			a.RefError = ""
			a.PathStatus = portainer.SourceStatusHealthy
			a.PathError = ""
		})
	}); err != nil {
		return errors.WithMessagef(err, "failed to update the stack %v", stack.ID)
	}

	return nil
}

// isEnvironmentOnline reports whether a stack on the environment can be redeployed.
// A legacy Portainer Agent environment never is: the Agent is removed (TAI-007).
func isEnvironmentOnline(endpoint *portainer.Endpoint) bool {
	return !portainer.IsAgentEnvironmentType(endpoint.Type)
}
