package scheduling

import (
	"context"
	"errors"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/source"
	"github.com/portainer/portainer/api/datastore"
	gittypes "github.com/portainer/portainer/api/git/types"
	"github.com/portainer/portainer/api/scheduler"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"

	"github.com/stretchr/testify/require"
)

type stubDataStore struct {
	sources   dataservices.SourceService
	workflows dataservices.WorkflowService
}

func (s stubDataStore) Source() dataservices.SourceService     { return s.sources }
func (s stubDataStore) Workflow() dataservices.WorkflowService { return s.workflows }

type sourceServiceStub struct {
	dataservices.SourceService
	readErr    error
	readAllErr error
	readResult *portainer.Source
	readAll    []portainer.Source
}

func (s sourceServiceStub) Read(ctx dataservices.SourceServiceUserContext, id portainer.SourceID) (*portainer.Source, error) {
	if s.readErr != nil {
		return nil, s.readErr
	}
	if s.readResult != nil {
		return s.readResult, nil
	}
	return s.SourceService.Read(ctx, id)
}

func (s sourceServiceStub) ReadAll(ctx dataservices.SourceServiceUserContext, predicates ...func(portainer.Source) bool) ([]portainer.Source, error) {
	if s.readAllErr != nil {
		return nil, s.readAllErr
	}
	if s.readAll != nil {
		return s.readAll, nil
	}
	return s.SourceService.ReadAll(ctx, predicates...)
}

type workflowServiceStub struct {
	dataservices.WorkflowService
	readAllErr error
	readAll    []portainer.Workflow
}

func (s workflowServiceStub) ReadAll(predicates ...func(portainer.Workflow) bool) ([]portainer.Workflow, error) {
	if s.readAllErr != nil {
		return nil, s.readAllErr
	}
	if s.readAll != nil {
		out := make([]portainer.Workflow, 0, len(s.readAll))
		for _, wf := range s.readAll {
			ok := true
			for _, p := range predicates {
				if !p(wf) {
					ok = false
					break
				}
			}
			if ok {
				out = append(out, wf)
			}
		}
		return out, nil
	}
	return s.WorkflowService.ReadAll(predicates...)
}

func TestReconcileNilSchedulerOrZeroID(t *testing.T) {
	t.Parallel()

	var nilSched *SourceScheduler
	require.NoError(t, nilSched.Reconcile(1))

	_, store := datastore.MustNewTestStore(t, false, true)
	sched := scheduler.NewScheduler(t.Context())
	poller := NewSourceScheduler(sched, store, Deployers{})
	require.NoError(t, poller.Reconcile(0))
}

func TestReconcileAllPropagatesSourceReadError(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	sched := scheduler.NewScheduler(t.Context())
	wantErr := errors.New("source list boom")
	poller := NewSourceScheduler(sched, stubDataStore{
		sources: sourceServiceStub{
			SourceService: store.Source(),
			readAllErr:    wantErr,
		},
		workflows: store.Workflow(),
	}, Deployers{})

	err := poller.ReconcileAll()
	require.ErrorIs(t, err, wantErr)
}

func TestReconcileAllLogsReconcileSourceError(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	sysCtx := source.InsecureNewAdminContext()

	src := &portainer.Source{
		Name:     "bad-interval",
		Type:     portainer.SourceTypeGit,
		Git:      &gittypes.GitSource{URL: "https://example.com/repo.git"},
		Interval: "not-a-duration",
	}
	require.NoError(t, store.Source().Create(sysCtx, src))
	require.NoError(t, store.Workflow().Create(&portainer.Workflow{
		Name: "wf",
		Artifacts: []portainer.Artifact{
			{StackID: 1, Files: []portainer.ArtifactFile{{SourceID: src.ID}}},
		},
	}))

	sched := scheduler.NewScheduler(t.Context())
	poller := NewSourceScheduler(sched, store, Deployers{
		Stack: func(context.Context, portainer.StackID) error { return nil },
	})

	// ReconcileAll swallows per-source errors after logging them.
	require.NoError(t, poller.ReconcileAll())
	_, ok := poller.jobs[src.ID]
	require.False(t, ok)
}

func TestReconcileReadSourceNonNotFoundError(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	sched := scheduler.NewScheduler(t.Context())
	wantErr := errors.New("db read boom")
	poller := NewSourceScheduler(sched, stubDataStore{
		sources: sourceServiceStub{
			SourceService: store.Source(),
			readErr:       wantErr,
		},
		workflows: store.Workflow(),
	}, Deployers{})

	err := poller.Reconcile(42)
	require.Error(t, err)
	require.ErrorIs(t, err, wantErr)
}

func TestReconcileSourceReferencedError(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	sysCtx := source.InsecureNewAdminContext()
	src := &portainer.Source{
		Name:     "ref-err",
		Type:     portainer.SourceTypeGit,
		Git:      &gittypes.GitSource{URL: "https://example.com/repo.git"},
		Interval: "1h",
	}
	require.NoError(t, store.Source().Create(sysCtx, src))

	sched := scheduler.NewScheduler(t.Context())
	wantErr := errors.New("workflow list boom")
	poller := NewSourceScheduler(sched, stubDataStore{
		sources: store.Source(),
		workflows: workflowServiceStub{
			WorkflowService: store.Workflow(),
			readAllErr:      wantErr,
		},
	}, Deployers{})

	err := poller.Reconcile(src.ID)
	require.ErrorIs(t, err, wantErr)
}

func TestReconcileInvalidInterval(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	sysCtx := source.InsecureNewAdminContext()
	src := &portainer.Source{
		Name:     "bad",
		Type:     portainer.SourceTypeGit,
		Git:      &gittypes.GitSource{URL: "https://example.com/repo.git"},
		Interval: "banana",
	}
	require.NoError(t, store.Source().Create(sysCtx, src))
	require.NoError(t, store.Workflow().Create(&portainer.Workflow{
		Name: "wf",
		Artifacts: []portainer.Artifact{
			{StackID: 7, Files: []portainer.ArtifactFile{{SourceID: src.ID}}},
		},
	}))

	sched := scheduler.NewScheduler(t.Context())
	poller := NewSourceScheduler(sched, store, Deployers{
		Stack: func(context.Context, portainer.StackID) error { return nil },
	})

	err := poller.Reconcile(src.ID)
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid interval")
}

func TestReconcileSameIntervalIsNoop(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	sysCtx := source.InsecureNewAdminContext()
	src := &portainer.Source{
		Name:     "stable",
		Type:     portainer.SourceTypeGit,
		Git:      &gittypes.GitSource{URL: "https://example.com/repo.git"},
		Interval: "1h",
	}
	require.NoError(t, store.Source().Create(sysCtx, src))
	require.NoError(t, store.Workflow().Create(&portainer.Workflow{
		Name: "wf",
		Artifacts: []portainer.Artifact{
			{StackID: 7, Files: []portainer.ArtifactFile{{SourceID: src.ID}}},
		},
	}))

	sched := scheduler.NewScheduler(t.Context())
	poller := NewSourceScheduler(sched, store, Deployers{
		Stack: func(context.Context, portainer.StackID) error { return nil },
	})
	require.NoError(t, poller.Reconcile(src.ID))
	first := poller.jobs[src.ID]
	require.NoError(t, poller.Reconcile(src.ID))
	second := poller.jobs[src.ID]
	require.Equal(t, first.jobID, second.jobID)
	require.Equal(t, "1h", second.interval)
}

func TestStopLockedWarnsOnStopJobError(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	sched := scheduler.NewScheduler(t.Context())
	poller := NewSourceScheduler(sched, store, Deployers{})
	poller.jobs[9] = jobEntry{jobID: "not-an-int", interval: "1h"}
	poller.stopLocked(9)
	_, ok := poller.jobs[9]
	require.False(t, ok)
}

func TestTickWorkflowReadAllError(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	sched := scheduler.NewScheduler(t.Context())
	wantErr := errors.New("wf boom")
	poller := NewSourceScheduler(sched, stubDataStore{
		sources: store.Source(),
		workflows: workflowServiceStub{
			WorkflowService: store.Workflow(),
			readAllErr:      wantErr,
		},
	}, Deployers{})

	err := poller.tick(t.Context(), 1)
	require.ErrorIs(t, err, wantErr)
}

func TestTickSkipsUnrelatedArtifacts(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	sysCtx := source.InsecureNewAdminContext()
	src := &portainer.Source{
		Name: "shared",
		Type: portainer.SourceTypeGit,
		Git:  &gittypes.GitSource{URL: "https://example.com/repo.git"},
	}
	require.NoError(t, store.Source().Create(sysCtx, src))
	other := &portainer.Source{
		Name: "other",
		Type: portainer.SourceTypeGit,
		Git:  &gittypes.GitSource{URL: "https://example.com/other.git"},
	}
	require.NoError(t, store.Source().Create(sysCtx, other))

	// One workflow mixes a matching artifact with an unrelated one so the
	// !artifactReferencesSource continue path runs inside tick.
	require.NoError(t, store.Workflow().Create(&portainer.Workflow{
		Name: "mixed",
		Artifacts: []portainer.Artifact{
			{StackID: 1, Files: []portainer.ArtifactFile{{SourceID: other.ID}}},
			{StackID: 2, Files: []portainer.ArtifactFile{{SourceID: src.ID}}},
		},
	}))

	var stacks []portainer.StackID
	sched := scheduler.NewScheduler(t.Context())
	poller := NewSourceScheduler(sched, store, Deployers{
		Stack: func(_ context.Context, id portainer.StackID) error {
			stacks = append(stacks, id)
			return nil
		},
	})
	require.NoError(t, poller.tick(t.Context(), src.ID))
	require.Equal(t, []portainer.StackID{2}, stacks)
}

func TestDeployArtifactStackErrorIsLogged(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	sched := scheduler.NewScheduler(t.Context())
	poller := NewSourceScheduler(sched, store, Deployers{
		Stack: func(context.Context, portainer.StackID) error {
			return httperror.InternalServerError("deploy failed", errors.New("root cause"))
		},
	})
	poller.deployArtifact(t.Context(), portainer.Artifact{StackID: 5})
}

func TestSourceReferencedSkipsUnrelatedArtifacts(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, false, true)
	sysCtx := source.InsecureNewAdminContext()
	src := &portainer.Source{
		Name: "shared",
		Type: portainer.SourceTypeGit,
		Git:  &gittypes.GitSource{URL: "https://example.com/repo.git"},
	}
	require.NoError(t, store.Source().Create(sysCtx, src))
	other := &portainer.Source{
		Name: "other",
		Type: portainer.SourceTypeGit,
		Git:  &gittypes.GitSource{URL: "https://example.com/other.git"},
	}
	require.NoError(t, store.Source().Create(sysCtx, other))
	require.NoError(t, store.Workflow().Create(&portainer.Workflow{
		Name: "mixed",
		Artifacts: []portainer.Artifact{
			{StackID: 1, Files: []portainer.ArtifactFile{{SourceID: other.ID}}},
			{StackID: 2, Files: []portainer.ArtifactFile{{SourceID: src.ID}}},
		},
	}))

	sched := scheduler.NewScheduler(t.Context())
	poller := NewSourceScheduler(sched, store, Deployers{})
	ok, err := poller.sourceReferenced(src.ID)
	require.NoError(t, err)
	require.True(t, ok)
}
