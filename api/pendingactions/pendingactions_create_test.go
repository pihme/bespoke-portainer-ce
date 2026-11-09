package pendingactions

import (
	"sync"
	"testing"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	dserrors "github.com/portainer/portainer/api/dataservices/errors"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/api/slicesx"
	"github.com/stretchr/testify/require"
)

type recordingHandler struct {
	mu    sync.Mutex
	calls int
}

func (h *recordingHandler) Execute(portainer.PendingAction, *portainer.Endpoint) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.calls++
	return nil
}

// pendingOnlyTx is a minimal DataStoreTx stand-in: Create only needs PendingActions().
type pendingOnlyTx struct {
	dataservices.DataStoreTx
	pending dataservices.PendingActionsService
}

func (tx pendingOnlyTx) PendingActions() dataservices.PendingActionsService { return tx.pending }

type mutablePendingService struct {
	actions []portainer.PendingAction
	nextID  portainer.PendingActionID
}

func (s *mutablePendingService) BucketName() string { return "pending_actions" }
func (s *mutablePendingService) Create(action *portainer.PendingAction) error {
	s.nextID++
	action.ID = s.nextID
	s.actions = append(s.actions, *action)
	return nil
}
func (s *mutablePendingService) Read(id portainer.PendingActionID) (*portainer.PendingAction, error) {
	for i := range s.actions {
		if s.actions[i].ID == id {
			return &s.actions[i], nil
		}
	}
	return nil, dserrors.ErrObjectNotFound
}
func (s *mutablePendingService) Exists(id portainer.PendingActionID) (bool, error) {
	_, err := s.Read(id)
	return err == nil, nil
}
func (s *mutablePendingService) ReadAll(predicates ...func(portainer.PendingAction) bool) ([]portainer.PendingAction, error) {
	filtered := append([]portainer.PendingAction(nil), s.actions...)
	for _, predicate := range predicates {
		filtered = slicesx.Filter(filtered, predicate)
	}
	return filtered, nil
}
func (s *mutablePendingService) Update(id portainer.PendingActionID, action *portainer.PendingAction) error {
	for i := range s.actions {
		if s.actions[i].ID == id {
			s.actions[i] = *action
			return nil
		}
	}
	return dserrors.ErrObjectNotFound
}
func (s *mutablePendingService) Delete(id portainer.PendingActionID) error {
	out := s.actions[:0]
	for _, a := range s.actions {
		if a.ID != id {
			out = append(out, a)
		}
	}
	s.actions = out
	return nil
}
func (s *mutablePendingService) GetNextIdentifier() int {
	return int(s.nextID) + 1
}
func (s *mutablePendingService) DeleteByEndpointID(id portainer.EndpointID) error {
	out := s.actions[:0]
	for _, a := range s.actions {
		if a.EndpointID != id {
			out = append(out, a)
		}
	}
	s.actions = out
	return nil
}

func TestCreateLocalDockerPendingActionAndSkipDuplicate(t *testing.T) {
	t.Parallel()

	pending := &mutablePendingService{}
	svc := NewService(nil, nil)

	action := portainer.PendingAction{
		EndpointID: 7,
		Action:     "local-docker-migrate",
		ActionData: "same",
	}

	tx := pendingOnlyTx{pending: pending}
	require.NoError(t, svc.Create(tx, action))
	require.NoError(t, svc.Create(tx, action))

	all, err := pending.ReadAll()
	require.NoError(t, err)
	require.Len(t, all, 1)
	require.Equal(t, "local-docker-migrate", all[0].Action)
}

func TestExecuteLocalDockerEndpointRunsHandler(t *testing.T) {
	t.Parallel()

	endpoint := portainer.Endpoint{
		ID:     9,
		Name:   "local",
		Type:   portainer.DockerEnvironment,
		Status: portainer.EndpointStatusUp,
		URL:    "unix:///var/run/docker.sock",
	}
	store := testhelpers.NewDatastore(
		testhelpers.WithEndpoints([]portainer.Endpoint{endpoint}),
		testhelpers.WithPendingActions([]portainer.PendingAction{{
			ID:         1,
			EndpointID: 9,
			Action:     "local-docker-test",
		}}),
	)

	handler := &recordingHandler{}
	svc := NewService(store, nil)
	svc.RegisterHandler("local-docker-test", handler)

	svc.Execute(9)

	require.Eventually(t, func() bool {
		handler.mu.Lock()
		defer handler.mu.Unlock()
		return handler.calls == 1
	}, 2*time.Second, 20*time.Millisecond)

	all, err := store.PendingActions().ReadAll()
	require.NoError(t, err)
	require.Empty(t, all)
}

func TestExecuteMissingEndpointNoOp(t *testing.T) {
	t.Parallel()
	store := testhelpers.NewDatastore(testhelpers.WithEndpoints(nil))
	svc := NewService(store, nil)
	svc.execute(404)
}
