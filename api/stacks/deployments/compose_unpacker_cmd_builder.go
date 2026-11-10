package deployments

import (
	"fmt"

	portainer "github.com/portainer/portainer/api"
	gittypes "github.com/portainer/portainer/api/git/types"
)

type StackRemoteOperation string

const (
	OperationDeploy       StackRemoteOperation = "compose-deploy"
	OperationUndeploy     StackRemoteOperation = "compose-undeploy"
	OperationComposeStart StackRemoteOperation = "compose-start"
	OperationComposeStop  StackRemoteOperation = "compose-stop"
)

const (
	UnpackerCmdDeploy   = "deploy"
	UnpackerCmdUndeploy = "undeploy"
)

type unpackerCmdBuilderOptions struct {
	pullImage          bool
	prune              bool
	forceRecreate      bool
	composeDestination string
	gitConfig          *gittypes.RepoConfig
}

type buildCmdFunc func(stack *portainer.Stack, opts unpackerCmdBuilderOptions, env []string) []string

var funcmap = map[StackRemoteOperation]buildCmdFunc{
	OperationDeploy:       buildDeployCmd,
	OperationUndeploy:     buildUndeployCmd,
	OperationComposeStart: buildComposeStartCmd,
	OperationComposeStop:  buildComposeStopCmd,
}

// build the unpacker cmd for stack based on stackOperation
func (d *stackDeployer) buildUnpackerCmdForStack(stack *portainer.Stack, operation StackRemoteOperation, opts unpackerCmdBuilderOptions) ([]string, error) {
	fn := funcmap[operation]
	if fn == nil {
		return nil, fmt.Errorf("unknown stack operation %s", operation)
	}

	envStrings := getEnv(stack.Env)

	return fn(stack, opts, envStrings), nil
}

// deploy [-u username -p password] [--skip-tls-verify] [--force-recreate] [-r] [-k] [--env KEY1=VALUE1 --env KEY2=VALUE2] <git-repo-url> <ref> <project-name> <destination> <compose-file-path> [<more-file-paths>...]
func buildDeployCmd(stack *portainer.Stack, opts unpackerCmdBuilderOptions, env []string) []string {
	cmd := []string{UnpackerCmdDeploy}
	cmd = appendGitAuthIfNeeded(cmd, opts.gitConfig)
	cmd = appendSkipTLSVerifyIfNeeded(cmd, opts.gitConfig)
	cmd = appendForceRecreateIfNeeded(cmd, opts.forceRecreate)

	if opts.prune {
		cmd = append(cmd, "-r")
	}

	cmd = append(cmd, env...)
	cmd = append(cmd,
		opts.gitConfig.URL,
		opts.gitConfig.ReferenceName,
		stack.Name,
		opts.composeDestination,
		stack.EntryPoint,
	)

	return append(cmd, stack.AdditionalFiles...)
}

// undeploy [-u username -p password] [-k] <git-repo-url> <project-name> <destination> <compose-file-path> [<more-file-paths>...]
func buildUndeployCmd(stack *portainer.Stack, opts unpackerCmdBuilderOptions, env []string) []string {
	cmd := []string{UnpackerCmdUndeploy}
	cmd = appendGitAuthIfNeeded(cmd, opts.gitConfig)
	cmd = append(cmd, opts.gitConfig.URL,
		stack.Name,
		opts.composeDestination,
		stack.EntryPoint,
	)

	return append(cmd, stack.AdditionalFiles...)
}

// deploy [-u username -p password] [--skip-tls-verify] [-k] [--env KEY1=VALUE1 --env KEY2=VALUE2] <git-repo-url> <project-name> <destination> <compose-file-path> [<more-file-paths>...]
func buildComposeStartCmd(stack *portainer.Stack, opts unpackerCmdBuilderOptions, env []string) []string {
	cmd := []string{UnpackerCmdDeploy}
	cmd = appendGitAuthIfNeeded(cmd, opts.gitConfig)
	cmd = appendSkipTLSVerifyIfNeeded(cmd, opts.gitConfig)
	cmd = append(cmd, "-k")
	cmd = append(cmd, env...)
	cmd = append(cmd, opts.gitConfig.URL,
		opts.gitConfig.ReferenceName,
		stack.Name,
		opts.composeDestination,
		stack.EntryPoint,
	)

	return append(cmd, stack.AdditionalFiles...)
}

// undeploy [-u username -p password] [-k] <git-repo-url> <project-name> <destination> <compose-file-path> [<more-file-paths>...]
func buildComposeStopCmd(stack *portainer.Stack, opts unpackerCmdBuilderOptions, env []string) []string {
	cmd := []string{UnpackerCmdUndeploy}
	cmd = appendGitAuthIfNeeded(cmd, opts.gitConfig)
	cmd = append(cmd,
		"-k",
		opts.gitConfig.URL,
		stack.Name,
		opts.composeDestination,
		stack.EntryPoint,
	)

	return append(cmd, stack.AdditionalFiles...)
}

func appendGitAuthIfNeeded(cmd []string, gc *gittypes.RepoConfig) []string {
	if gc == nil || gc.Authentication == nil || gc.Authentication.Password == "" {
		return cmd
	}

	return append(cmd, "-u", gc.Authentication.Username, "-p", gc.Authentication.Password)
}

func appendSkipTLSVerifyIfNeeded(cmd []string, gc *gittypes.RepoConfig) []string {
	if gc == nil || !gc.TLSSkipVerify {
		return cmd
	}

	return append(cmd, "--skip-tls-verify")
}

func appendForceRecreateIfNeeded(cmd []string, forceRecreate bool) []string {
	if forceRecreate {
		cmd = append(cmd, "--force-recreate")
	}

	return cmd
}

func getEnv(env []portainer.Pair) []string {
	if len(env) == 0 {
		return nil
	}

	cmd := []string{}
	for _, pair := range env {
		cmd = append(cmd, fmt.Sprintf(`--env=%s=%s`, pair.Name, pair.Value))
	}

	return cmd
}
