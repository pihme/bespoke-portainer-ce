package stack_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices/errors"
	"github.com/portainer/portainer/api/dataservices/stack"
	"github.com/portainer/portainer/api/datastore"
	gittypes "github.com/portainer/portainer/api/git/types"

	"github.com/stretchr/testify/require"
)

func composeStack(id portainer.StackID, name string) *portainer.Stack {
	return &portainer.Stack{
		ID:         id,
		Name:       name,
		Type:       portainer.DockerComposeStack,
		EndpointID: 1,
		EntryPoint: "docker-compose.yml",
		Status:     portainer.StackStatusActive,
	}
}

// TestREQ_STK_02_CreateAndUpdateLocalComposeStack persists and updates a
// local Compose stack, including the deprecated GitConfig warn path.
func TestREQ_STK_02_CreateAndUpdateLocalComposeStack(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	id := portainer.StackID(store.Stack().GetNextIdentifier())
	st := composeStack(id, "web")
	require.NoError(t, store.Stack().Create(st))

	got, err := store.Stack().Read(id)
	require.NoError(t, err)
	require.Equal(t, "web", got.Name)
	require.Equal(t, portainer.DockerComposeStack, got.Type)

	got.Name = "web-renamed"
	require.NoError(t, store.Stack().Update(id, got))
	updated, err := store.Stack().Read(id)
	require.NoError(t, err)
	require.Equal(t, "web-renamed", updated.Name)

	// GitConfig warn arms on Create and Update
	id2 := portainer.StackID(store.Stack().GetNextIdentifier())
	withGit := composeStack(id2, "git-warn")
	withGit.GitConfig = &gittypes.RepoConfig{URL: "https://example.test/repo.git"}
	require.NoError(t, store.Stack().Create(withGit))
	withGit.Name = "git-warn-2"
	require.NoError(t, store.Stack().Update(id2, withGit))
}

// TestREQ_STK_01_StackByNameAndStacksByName finds local Compose stacks by name.
func TestREQ_STK_01_StackByNameAndStacksByName(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	id1 := portainer.StackID(store.Stack().GetNextIdentifier())
	require.NoError(t, store.Stack().Create(composeStack(id1, "shared")))
	id2 := portainer.StackID(store.Stack().GetNextIdentifier())
	require.NoError(t, store.Stack().Create(composeStack(id2, "shared")))
	id3 := portainer.StackID(store.Stack().GetNextIdentifier())
	require.NoError(t, store.Stack().Create(composeStack(id3, "other")))

	one, err := store.Stack().StackByName("shared")
	require.NoError(t, err)
	require.Equal(t, "shared", one.Name)

	many, err := store.Stack().StacksByName("shared")
	require.NoError(t, err)
	require.Len(t, many, 2)

	_, err = store.Stack().StackByName("missing")
	require.ErrorIs(t, err, errors.ErrObjectNotFound)

	none, err := store.Stack().StacksByName("missing")
	require.NoError(t, err)
	require.Empty(t, none)
}

// TestREQ_STK_09_StackByWebhookID finds a stack by auto-update webhook.
func TestREQ_STK_09_StackByWebhookID(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	id := portainer.StackID(store.Stack().GetNextIdentifier())
	st := composeStack(id, "hooked")
	st.AutoUpdate = &portainer.AutoUpdateSettings{Webhook: "AbC-Webhook"}
	require.NoError(t, store.Stack().Create(st))

	id2 := portainer.StackID(store.Stack().GetNextIdentifier())
	plain := composeStack(id2, "plain")
	plain.AutoUpdate = &portainer.AutoUpdateSettings{Webhook: ""}
	require.NoError(t, store.Stack().Create(plain))

	id3 := portainer.StackID(store.Stack().GetNextIdentifier())
	require.NoError(t, store.Stack().Create(composeStack(id3, "nil-auto")))

	got, err := store.Stack().StackByWebhookID("abc-webhook")
	require.NoError(t, err)
	require.Equal(t, id, got.ID)

	_, err = store.Stack().StackByWebhookID("no-such")
	require.ErrorIs(t, err, errors.ErrObjectNotFound)
}

func TestNewServiceAndTx(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	svc := store.StackService
	require.NotNil(t, svc)

	conn := store.Connection()
	require.NoError(t, conn.UpdateTx(func(tx portainer.Transaction) error {
		stx := svc.Tx(tx)
		require.NotNil(t, stx.Tx)
		return nil
	}))

	// NewService against the same connection succeeds (bucket already set).
	again, err := stack.NewService(conn)
	require.NoError(t, err)
	require.NotNil(t, again)
}

func TestGetNextIdentifierIncrements(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	a := store.Stack().GetNextIdentifier()
	b := store.Stack().GetNextIdentifier()
	require.Greater(t, b, a)
}
