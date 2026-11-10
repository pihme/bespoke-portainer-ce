package workflows

import (
	"slices"

	portainer "github.com/portainer/portainer/api"
)

// WorkflowMappingFields holds the fields shared between ArtifactDetail and the sources handler package's Workflow type.
type WorkflowMappingFields struct {
	Type         Type                          `json:"type" validate:"required"`
	Name         string                        `json:"name" validate:"required"`
	Platform     DeploymentPlatform            `json:"platform"`
	Status       WorkflowStatusObject          `json:"status"`
	AutoUpdate   *portainer.AutoUpdateSettings `json:"autoUpdate,omitempty"`
	Target       Target                        `json:"target"`
	CreationDate int64                         `json:"creationDate"`
	LastSyncDate int64                         `json:"lastSyncDate"`
}

// DeriveStackWorkflowFields computes the shared WorkflowMappingFields for a Stack-backed deployment.
func DeriveStackWorkflowFields(s portainer.Stack, source, artifact WorkflowPhaseStatus) WorkflowMappingFields {
	return WorkflowMappingFields{
		Type:     TypeStack,
		Name:     s.Name,
		Platform: platformFromStackType(s.Type),
		Status: WorkflowStatusObject{
			Source:   source,
			Artifact: artifact,
			Target:   deriveStackTargetState(s),
		},
		AutoUpdate: s.AutoUpdate,
		Target: Target{
			EndpointID: s.EndpointID,
			Namespace:  s.Namespace,
		},
		CreationDate: s.CreationDate,
		LastSyncDate: StackLastSyncDate(s),
	}
}

func StackLastSyncDate(s portainer.Stack) int64 {
	for _, ds := range slices.Backward(s.DeploymentStatus) {
		if ds.Status == portainer.StackStatusActive {
			return ds.Time
		}
	}
	return 0
}

func platformFromStackType(t portainer.StackType) DeploymentPlatform {
	switch t {
	case portainer.KubernetesStack:
		return DeploymentPlatformKubernetes
	case portainer.DockerSwarmStack:
		return DeploymentPlatformDockerSwarm
	default:
		return DeploymentPlatformDockerStandalone
	}
}
