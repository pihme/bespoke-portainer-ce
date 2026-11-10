package workflows

import portainer "github.com/portainer/portainer/api"

func SourceStatusToPhase(s portainer.SourceStatus, errMsg string) WorkflowPhaseStatus {
	switch s {
	case portainer.SourceStatusHealthy:
		return WorkflowPhaseStatus{Status: StatusHealthy}
	case portainer.SourceStatusError:
		return WorkflowPhaseStatus{Status: StatusError, Error: errMsg}
	default:
		return WorkflowPhaseStatus{Status: StatusUnknown}
	}
}

func deriveStackTargetState(s portainer.Stack) WorkflowPhaseStatus {
	if len(s.DeploymentStatus) == 0 {
		return WorkflowPhaseStatus{Status: StatusHealthy}
	}
	last := s.DeploymentStatus[len(s.DeploymentStatus)-1]
	switch last.Status {
	case portainer.StackStatusActive:
		return WorkflowPhaseStatus{Status: StatusHealthy}
	case portainer.StackStatusError:
		return WorkflowPhaseStatus{Status: StatusError, Error: last.Message}
	case portainer.StackStatusDeploying:
		return WorkflowPhaseStatus{Status: StatusSyncing}
	case portainer.StackStatusInactive:
		return WorkflowPhaseStatus{Status: StatusPaused}
	default:
		return WorkflowPhaseStatus{Status: StatusUnknown}
	}
}
