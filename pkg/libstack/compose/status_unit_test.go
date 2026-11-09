package compose

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/portainer/portainer/pkg/libstack"

	"github.com/compose-spec/compose-go/v2/types"
	"github.com/docker/cli/cli/command"
	"github.com/docker/compose/v2/pkg/api"
	"github.com/docker/compose/v2/pkg/compose"
	"github.com/stretchr/testify/require"
)

func Test_getServiceStatus_LocalStates(t *testing.T) {
	ctx := t.Context()

	cases := []struct {
		name           string
		svc            service
		wantStatus     libstack.Status
		wantMsgSubstr  string
		wantEmptyMsg   bool
	}{
		{name: "created", svc: service{Name: "a", State: "created"}, wantStatus: libstack.StatusStarting, wantEmptyMsg: true},
		{name: "restarting", svc: service{Name: "a", State: "restarting"}, wantStatus: libstack.StatusStarting, wantEmptyMsg: true},
		{name: "paused", svc: service{Name: "a", State: "paused"}, wantStatus: libstack.StatusStarting, wantEmptyMsg: true},
		{name: "running", svc: service{Name: "a", State: "running"}, wantStatus: libstack.StatusRunning, wantEmptyMsg: true},
		{name: "removing", svc: service{Name: "a", State: "removing"}, wantStatus: libstack.StatusRemoving, wantEmptyMsg: true},
		{name: "exited_ok", svc: service{Name: "a", State: "exited", ExitCode: 0}, wantStatus: libstack.StatusCompleted, wantEmptyMsg: true},
		{name: "dead_ok", svc: service{Name: "a", State: "dead", ExitCode: 0}, wantStatus: libstack.StatusRemoved, wantEmptyMsg: true},
		{name: "unknown", svc: service{Name: "a", State: "something-else"}, wantStatus: libstack.StatusUnknown, wantEmptyMsg: true},
		// No Docker daemon: log fetch fails and falls back to a synthesised message.
		{name: "exited_error_fallback", svc: service{Name: "svc-fail", State: "exited", ExitCode: 1}, wantStatus: libstack.StatusError, wantMsgSubstr: "exited with code 1"},
		{name: "dead_error_fallback", svc: service{Name: "svc-dead", State: "dead", ExitCode: 2}, wantStatus: libstack.StatusError, wantMsgSubstr: "exited with code 2"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, msg := getServiceStatus(ctx, tc.svc)
			require.Equal(t, tc.wantStatus, status)
			if tc.wantEmptyMsg {
				require.Empty(t, msg)
			} else {
				require.Contains(t, msg, tc.wantMsgSubstr)
			}
		})
	}
}

func Test_aggregateStatuses_Local(t *testing.T) {
	ctx := t.Context()

	t.Run("empty_is_removed", func(t *testing.T) {
		status, msg := aggregateStatuses(ctx, nil)
		require.Equal(t, libstack.StatusRemoved, status)
		require.Empty(t, msg)
	})

	t.Run("all_running", func(t *testing.T) {
		status, msg := aggregateStatuses(ctx, []service{
			{Name: "a", State: "running"},
			{Name: "b", State: "running"},
		})
		require.Equal(t, libstack.StatusRunning, status)
		require.Empty(t, msg)
	})

	t.Run("error_wins", func(t *testing.T) {
		status, msg := aggregateStatuses(ctx, []service{
			{Name: "ok", State: "running"},
			{Name: "bad", State: "exited", ExitCode: 1},
		})
		require.Equal(t, libstack.StatusError, status)
		require.Contains(t, msg, "exited with code 1")
	})

	t.Run("starting_wins_over_running", func(t *testing.T) {
		status, msg := aggregateStatuses(ctx, []service{
			{Name: "a", State: "running"},
			{Name: "b", State: "created"},
		})
		require.Equal(t, libstack.StatusStarting, status)
		require.Empty(t, msg)
	})

	t.Run("all_completed", func(t *testing.T) {
		status, msg := aggregateStatuses(ctx, []service{
			{Name: "a", State: "exited", ExitCode: 0},
			{Name: "b", State: "exited", ExitCode: 0},
		})
		require.Equal(t, libstack.StatusCompleted, status)
		require.Empty(t, msg)
	})
}

func Test_serviceListFromContainerSummary(t *testing.T) {
	in := []api.ContainerSummary{
		{
			ID:      "id1",
			Name:    "proj-web-1",
			Image:   "nginx:latest",
			Command: "nginx",
			Project: "proj",
			Service: "web",
			Created: 123,
			State:   "running",
			Status:  "Up 1s",
			Health:  "healthy",
			ExitCode: 0,
			Publishers: api.PortPublishers{
				{URL: "0.0.0.0", TargetPort: 80, PublishedPort: 8080, Protocol: "tcp"},
			},
		},
		{
			ID:    "id2",
			Name:  "proj-db-1",
			State: "exited",
		},
	}

	got := serviceListFromContainerSummary(in)
	require.Len(t, got, 2)
	require.Equal(t, "id1", got[0].ID)
	require.Equal(t, "proj-web-1", got[0].Name)
	require.Equal(t, "nginx:latest", got[0].Image)
	require.Equal(t, "nginx", got[0].Command)
	require.Equal(t, "proj", got[0].Project)
	require.Equal(t, "web", got[0].Service)
	require.Equal(t, int64(123), got[0].Created)
	require.Equal(t, "running", got[0].State)
	require.Equal(t, "Up 1s", got[0].Status)
	require.Equal(t, "healthy", got[0].Health)
	require.Len(t, got[0].Publishers, 1)
	require.Equal(t, "0.0.0.0", got[0].Publishers[0].URL)
	require.Equal(t, 80, got[0].Publishers[0].TargetPort)
	require.Equal(t, 8080, got[0].Publishers[0].PublishedPort)
	require.Equal(t, "tcp", got[0].Publishers[0].Protocol)
	require.Equal(t, "id2", got[1].ID)
	require.Equal(t, "exited", got[1].State)

	require.Empty(t, serviceListFromContainerSummary(nil))
}

func Test_WaitForStatus_Cancelled(t *testing.T) {
	w := ComposeDeployer{
		createComposeServiceFn: createMockComposeService,
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	result := w.WaitForStatus(ctx, "any-project", libstack.StatusRunning)
	require.Equal(t, libstack.StatusRunning, result.Status)
	require.Contains(t, result.ErrorMsg, "failed to wait for status")
	require.Contains(t, result.ErrorMsg, "canceled")
}

func Test_WaitForStatus_RemovedWhenEmpty(t *testing.T) {
	w := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				psFn: func(ctx context.Context, projectName string, options api.PsOptions) ([]api.ContainerSummary, error) {
					return nil, nil
				},
			}
		},
	}

	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()

	result := w.WaitForStatus(ctx, "gone-project", libstack.StatusRemoved)
	require.Equal(t, libstack.StatusRemoved, result.Status)
	require.Empty(t, result.ErrorMsg)
}

func Test_WaitForStatus_RunningMatch(t *testing.T) {
	w := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				psFn: func(ctx context.Context, projectName string, options api.PsOptions) ([]api.ContainerSummary, error) {
					require.Equal(t, "run-project", projectName)
					require.True(t, options.All)
					return []api.ContainerSummary{
						{Name: "run-project-web-1", State: "running"},
					}, nil
				},
			}
		},
	}

	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()

	result := w.WaitForStatus(ctx, "run-project", libstack.StatusRunning)
	require.Equal(t, libstack.StatusRunning, result.Status)
	require.Empty(t, result.ErrorMsg)
}

func Test_WaitForStatus_CompletedCountsAsRunning(t *testing.T) {
	w := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				psFn: func(ctx context.Context, projectName string, options api.PsOptions) ([]api.ContainerSummary, error) {
					return []api.ContainerSummary{
						{Name: "done-1", State: "exited", ExitCode: 0},
					}, nil
				},
			}
		},
	}

	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()

	result := w.WaitForStatus(ctx, "done-project", libstack.StatusRunning)
	require.Equal(t, libstack.StatusCompleted, result.Status)
	require.Empty(t, result.ErrorMsg)
}

func Test_WaitForStatus_ErrorMessageStops(t *testing.T) {
	w := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				psFn: func(ctx context.Context, projectName string, options api.PsOptions) ([]api.ContainerSummary, error) {
					return []api.ContainerSummary{
						{Name: "bad-1", State: "exited", ExitCode: 7},
					}, nil
				},
			}
		},
	}

	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()

	result := w.WaitForStatus(ctx, "bad-project", libstack.StatusRunning)
	require.Equal(t, libstack.StatusRunning, result.Status)
	require.Contains(t, result.ErrorMsg, "exited with code 7")
}

func Test_WaitForStatus_PsErrorThenCancel(t *testing.T) {
	calls := 0
	w := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				psFn: func(ctx context.Context, projectName string, options api.PsOptions) ([]api.ContainerSummary, error) {
					calls++
					return nil, errors.New("ps failed")
				},
			}
		},
	}

	ctx, cancel := context.WithTimeout(t.Context(), 2500*time.Millisecond)
	defer cancel()

	result := w.WaitForStatus(ctx, "retry-project", libstack.StatusRunning)
	require.Contains(t, result.ErrorMsg, "failed to wait for status")
	require.GreaterOrEqual(t, calls, 1)
}

func Test_WaitForStatus_PassesNilProjectWhenNoFiles(t *testing.T) {
	var sawNilProject bool
	w := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				psFn: func(ctx context.Context, projectName string, options api.PsOptions) ([]api.ContainerSummary, error) {
					return []api.ContainerSummary{
						{Name: "x", State: "running"},
					}, nil
				},
			}
		},
	}

	// Exercise withComposeService empty-filePaths branch used by WaitForStatus.
	err := w.withComposeService(t.Context(), nil, libstack.Options{ProjectName: "p"}, func(_ api.Compose, project *types.Project) error {
		sawNilProject = project == nil
		return nil
	})
	require.NoError(t, err)
	require.True(t, sawNilProject)

	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	result := w.WaitForStatus(ctx, "p", libstack.StatusRunning)
	require.Empty(t, result.ErrorMsg)
	require.Equal(t, libstack.StatusRunning, result.Status)
}
