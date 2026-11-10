package workflows

import (
	"slices"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/gitops/sources"
	"github.com/portainer/portainer/api/set"
	"github.com/portainer/portainer/api/slicesx"
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

// MapStackToArtifactDetail converts a stack to an ArtifactDetail.
func MapStackToArtifactDetail(stack portainer.Stack, files []portainer.ArtifactFile, source, artifact WorkflowPhaseStatus) ArtifactDetail {
	return ArtifactDetail{
		ID:                    int(stack.ID),
		WorkflowMappingFields: DeriveStackWorkflowFields(stack, source, artifact),
		Files:                 mapFilesToFileDetails(files),
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

// BuildWorkflow assembles a Workflow from a domain workflow and its resolved, access-filtered artifacts.
func BuildWorkflow(wf portainer.Workflow, artifacts []ArtifactDetail) Workflow {
	creation, lastSync := SummaryDates(artifacts)
	return Workflow{
		ID:           wf.ID,
		Name:         workflowName(wf),
		Status:       aggregateWorkflowStatus(artifacts),
		Artifacts:    artifacts,
		CreationDate: creation,
		LastSyncDate: lastSync,
	}
}

// workflowName returns the workflow's stored name, falling back to a placeholder when it has none.
func workflowName(wf portainer.Workflow) string {
	if wf.Name != "" {
		return wf.Name
	}

	return "Unnamed workflow"
}

// ShouldHideWorkflow reports whether a workflow must be hidden from the list (all artifacts filtered out, or none exist while an endpoint filter is active).
func ShouldHideWorkflow(wf portainer.Workflow, artifacts []ArtifactDetail, endpointIDSet set.Set[portainer.EndpointID]) bool {
	if len(artifacts) > 0 {
		return false
	}
	return len(wf.Artifacts) > 0 || len(endpointIDSet) > 0
}

// SummaryDates derives the earliest creation date and most recent sync date across artifacts, ignoring zero values.
func SummaryDates(artifacts []ArtifactDetail) (creation, lastSync int64) {
	for _, a := range artifacts {
		if a.CreationDate != 0 && (creation == 0 || a.CreationDate < creation) {
			creation = a.CreationDate
		}
		if a.LastSyncDate > lastSync {
			lastSync = a.LastSyncDate
		}
	}
	return creation, lastSync
}

func mapFilesToFileDetails(files []portainer.ArtifactFile) []ArtifactFileDetail {
	return slicesx.Map(files, func(file portainer.ArtifactFile) ArtifactFileDetail {
		return ArtifactFileDetail{
			ArtifactFile: file,
			RefStatus:    sources.StatusString(file.RefStatus),
			PathStatus:   sources.StatusString(file.PathStatus),
		}
	})
}
