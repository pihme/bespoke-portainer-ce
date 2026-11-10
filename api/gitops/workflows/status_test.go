package workflows

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/stretchr/testify/assert"
)

func TestREQ_GIT_01_DeriveStackTargetState_ComposeDeploymentStatuses(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		stack portainer.Stack
		want  WorkflowPhaseStatus
	}{
		{
			name:  "empty deployment status is healthy",
			stack: portainer.Stack{Name: "compose-app", Type: portainer.DockerComposeStack},
			want:  WorkflowPhaseStatus{Status: StatusHealthy},
		},
		{
			name: "active is healthy",
			stack: portainer.Stack{
				Type: portainer.DockerComposeStack,
				DeploymentStatus: []portainer.StackDeploymentStatus{
					{Status: portainer.StackStatusActive, Message: "ok"},
				},
			},
			want: WorkflowPhaseStatus{Status: StatusHealthy},
		},
		{
			name: "error keeps message",
			stack: portainer.Stack{
				Type: portainer.DockerComposeStack,
				DeploymentStatus: []portainer.StackDeploymentStatus{
					{Status: portainer.StackStatusError, Message: "compose up failed"},
				},
			},
			want: WorkflowPhaseStatus{Status: StatusError, Error: "compose up failed"},
		},
		{
			name: "deploying is syncing",
			stack: portainer.Stack{
				Type: portainer.DockerComposeStack,
				DeploymentStatus: []portainer.StackDeploymentStatus{
					{Status: portainer.StackStatusDeploying},
				},
			},
			want: WorkflowPhaseStatus{Status: StatusSyncing},
		},
		{
			name: "inactive is paused",
			stack: portainer.Stack{
				Type: portainer.DockerComposeStack,
				DeploymentStatus: []portainer.StackDeploymentStatus{
					{Status: portainer.StackStatusInactive},
				},
			},
			want: WorkflowPhaseStatus{Status: StatusPaused},
		},
		{
			name: "unknown status value",
			stack: portainer.Stack{
				Type: portainer.DockerComposeStack,
				DeploymentStatus: []portainer.StackDeploymentStatus{
					{Status: portainer.StackStatus(99)},
				},
			},
			want: WorkflowPhaseStatus{Status: StatusUnknown},
		},
		{
			name: "last entry wins",
			stack: portainer.Stack{
				Type: portainer.DockerComposeStack,
				DeploymentStatus: []portainer.StackDeploymentStatus{
					{Status: portainer.StackStatusActive},
					{Status: portainer.StackStatusError, Message: "latest"},
				},
			},
			want: WorkflowPhaseStatus{Status: StatusError, Error: "latest"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			fields := DeriveStackWorkflowFields(tc.stack, WorkflowPhaseStatus{Status: StatusHealthy}, WorkflowPhaseStatus{Status: StatusHealthy})
			assert.Equal(t, TypeStack, fields.Type)
			assert.Equal(t, DeploymentPlatformDockerStandalone, fields.Platform)
			assert.Equal(t, tc.want, fields.Status.Target)
		})
	}
}
