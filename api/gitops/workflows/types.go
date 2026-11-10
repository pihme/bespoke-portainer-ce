package workflows

import (
	"fmt"

	portainer "github.com/portainer/portainer/api"
)

type Status string

const (
	StatusHealthy Status = "healthy"
	StatusSyncing Status = "syncing"
	StatusError   Status = "error"
	StatusPaused  Status = "paused"
	StatusUnknown Status = "unknown"
)

type Type string

const (
	TypeStack Type = "stack"
)

type DeploymentPlatform string

const (
	DeploymentPlatformDockerStandalone DeploymentPlatform = "dockerStandalone"
	DeploymentPlatformDockerSwarm      DeploymentPlatform = "dockerSwarm"
	DeploymentPlatformKubernetes       DeploymentPlatform = "kubernetes"
)

func ParseStatus(s string) (Status, error) {
	switch Status(s) {
	case StatusHealthy, StatusSyncing, StatusError, StatusPaused, StatusUnknown:
		return Status(s), nil
	}
	return "", fmt.Errorf("unknown status %q", s)
}

type Target struct {
	EndpointID portainer.EndpointID `json:"endpointId,omitempty"`
	Namespace  string               `json:"namespace,omitempty"`
}

// WorkflowPhaseStatus represents the status of one phase (source, artifact, or target) of a workflow.
type WorkflowPhaseStatus struct {
	Status Status `json:"status"`
	Error  string `json:"error,omitempty"`
}

// WorkflowStatusObject is the structured status reported for a workflow.
type WorkflowStatusObject struct {
	Source   WorkflowPhaseStatus `json:"source"`
	Artifact WorkflowPhaseStatus `json:"artifact"`
	Target   WorkflowPhaseStatus `json:"target"`
}

type StatusSummary struct {
	Healthy int `json:"healthy"`
	Syncing int `json:"syncing"`
	Error   int `json:"error"`
	Paused  int `json:"paused"`
	Unknown int `json:"unknown"`
}
