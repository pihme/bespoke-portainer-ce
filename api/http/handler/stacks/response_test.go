package stacks

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices/source"
	"github.com/portainer/portainer/api/datastore"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewStackResponse_WithoutWorkflow_ReturnsStackOnly(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack := &portainer.Stack{
		ID:         1,
		Name:       "no-git",
		Type:       portainer.DockerComposeStack,
		WorkflowID: 0,
		Status:     portainer.StackStatusActive,
	}
	userContext := source.NewUserContext(&portainer.User{ID: 1}, nil)

	resp, err := newStackResponse(store, userContext, stack)
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, stack.ID, resp.ID)
	assert.Equal(t, stack.Name, resp.Name)
	assert.Zero(t, resp.GitSourceId)
	assert.Nil(t, resp.GitConfig)
}

func TestFillStackGitConfig_WithoutWorkflow_IsNoop(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)
	stack := &portainer.Stack{ID: 2, Name: "plain", WorkflowID: 0}
	userContext := source.NewUserContext(&portainer.User{ID: 1}, nil)

	err := fillStackGitConfig(store, userContext, stack)
	require.NoError(t, err)
	assert.Nil(t, stack.GitConfig)
}
