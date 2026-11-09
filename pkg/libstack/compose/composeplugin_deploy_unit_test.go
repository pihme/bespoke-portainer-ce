package compose

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/portainer/portainer/pkg/libstack"

	"github.com/compose-spec/compose-go/v2/types"
	"github.com/docker/cli/cli/command"
	cmdcompose "github.com/docker/compose/v2/cmd/compose"
	"github.com/docker/compose/v2/pkg/api"
	"github.com/docker/compose/v2/pkg/compose"
	"github.com/stretchr/testify/require"
)

const minimalComposeYAML = `services:
  web:
    image: alpine:latest
`

func writeComposeFile(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "docker-compose.yml")
	require.NoError(t, os.WriteFile(path, []byte(minimalComposeYAML), 0o644))
	return path
}

func TestREQ_STK_02_Deploy_ForceRecreateAndOrphans(t *testing.T) {
	var gotUp api.UpOptions
	var built bool

	w := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				buildFn: func(ctx context.Context, project *types.Project, options api.BuildOptions) error {
					built = true
					require.NotNil(t, project)
					require.Contains(t, project.Services, "web")
					// Labels applied by addServiceLabels before Up.
					require.Equal(t, "False", project.Services["web"].CustomLabels[api.OneoffLabel])
					require.Equal(t, project.Name, project.Services["web"].CustomLabels[api.ProjectLabel])
					return nil
				},
				upFn: func(ctx context.Context, project *types.Project, options api.UpOptions) error {
					gotUp = options
					return nil
				},
			}
		},
	}

	path := writeComposeFile(t)
	err := w.Deploy(t.Context(), []string{path}, libstack.DeployOptions{
		Options: libstack.Options{
			ProjectName: "stk02-deploy",
			Env: []string{
				cmdcompose.ComposeRemoveOrphans + "=true",
				cmdcompose.ComposeIgnoreOrphans + "=true",
			},
		},
		ForceRecreate:        true,
		AbortOnContainerExit: true,
		RemoveOrphans:        false, // env should override to true
	})
	require.NoError(t, err)
	require.True(t, built)
	require.Equal(t, api.RecreateForce, gotUp.Create.Recreate)
	require.True(t, gotUp.Create.RemoveOrphans)
	require.True(t, gotUp.Create.IgnoreOrphans)
	require.Equal(t, api.CascadeStop, gotUp.Start.OnExit)
}

func TestREQ_STK_02_Deploy_BuildError(t *testing.T) {
	w := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				buildFn: func(ctx context.Context, project *types.Project, options api.BuildOptions) error {
					return errors.New("build boom")
				},
			}
		},
	}

	err := w.Deploy(t.Context(), []string{writeComposeFile(t)}, libstack.DeployOptions{
		Options: libstack.Options{ProjectName: "stk02-build-err"},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "compose build operation failed")
}

func TestREQ_STK_02_Deploy_UpError(t *testing.T) {
	w := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				upFn: func(ctx context.Context, project *types.Project, options api.UpOptions) error {
					return errors.New("up boom")
				},
			}
		},
	}

	err := w.Deploy(t.Context(), []string{writeComposeFile(t)}, libstack.DeployOptions{
		Options: libstack.Options{ProjectName: "stk02-up-err"},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "compose up operation failed")
}

func TestREQ_STK_02_Deploy_RemoveOrphansFromOptions(t *testing.T) {
	var gotUp api.UpOptions
	w := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				upFn: func(ctx context.Context, project *types.Project, options api.UpOptions) error {
					gotUp = options
					return nil
				},
			}
		},
	}

	err := w.Deploy(t.Context(), []string{writeComposeFile(t)}, libstack.DeployOptions{
		Options:       libstack.Options{ProjectName: "stk02-orphans-opt"},
		RemoveOrphans: true,
	})
	require.NoError(t, err)
	require.True(t, gotUp.Create.RemoveOrphans)
	require.Empty(t, gotUp.Create.Recreate) // ForceRecreate false leaves default
}

func TestREQ_STK_02_Run_OneOffService(t *testing.T) {
	var gotCreate api.CreateOptions
	var gotRun api.RunOptions
	var sawDisabled bool

	w := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				createFn: func(ctx context.Context, project *types.Project, options api.CreateOptions) error {
					gotCreate = options
					// Run moves the named service into DisabledServices before Create.
					_, ok := project.DisabledServices["web"]
					sawDisabled = ok
					require.Empty(t, project.Services)
					return nil
				},
				runOneOffFn: func(ctx context.Context, project *types.Project, opts api.RunOptions) (int, error) {
					gotRun = opts
					require.Contains(t, project.Services, "web")
					require.Equal(t, "True", project.Services["web"].CustomLabels[api.OneoffLabel])
					return 0, nil
				},
			}
		},
	}

	err := w.Run(t.Context(), []string{writeComposeFile(t)}, "web", libstack.RunOptions{
		Options:  libstack.Options{ProjectName: "stk02-run"},
		Remove:   true,
		Detached: true,
		Args:     []string{"echo", "hi"},
	})
	require.NoError(t, err)
	require.True(t, sawDisabled)
	require.True(t, gotCreate.RemoveOrphans)
	require.True(t, gotRun.AutoRemove)
	require.True(t, gotRun.Detach)
	require.Equal(t, "web", gotRun.Service)
	require.Equal(t, []string{"echo", "hi"}, gotRun.Command)
}

func TestREQ_STK_02_Run_CreateError(t *testing.T) {
	w := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				createFn: func(ctx context.Context, project *types.Project, options api.CreateOptions) error {
					return errors.New("create boom")
				},
			}
		},
	}

	err := w.Run(t.Context(), []string{writeComposeFile(t)}, "web", libstack.RunOptions{
		Options: libstack.Options{ProjectName: "stk02-run-create-err"},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "compose create operation failed")
}

func TestREQ_STK_02_Run_RunOneOffError(t *testing.T) {
	w := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				runOneOffFn: func(ctx context.Context, project *types.Project, opts api.RunOptions) (int, error) {
					return 1, errors.New("run boom")
				},
			}
		},
	}

	err := w.Run(t.Context(), []string{writeComposeFile(t)}, "web", libstack.RunOptions{
		Options: libstack.Options{ProjectName: "stk02-run-err"},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "compose run operation failed")
}

func TestREQ_STK_02_Pull_SuccessAndError(t *testing.T) {
	pulled := false
	w := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				pullFn: func(ctx context.Context, project *types.Project, options api.PullOptions) error {
					pulled = true
					require.Contains(t, project.Services, "web")
					return nil
				},
			}
		},
	}

	err := w.Pull(t.Context(), []string{writeComposeFile(t)}, libstack.Options{ProjectName: "stk02-pull"})
	require.NoError(t, err)
	require.True(t, pulled)

	wErr := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				pullFn: func(ctx context.Context, project *types.Project, options api.PullOptions) error {
					return errors.New("pull boom")
				},
			}
		},
	}
	err = wErr.Pull(t.Context(), []string{writeComposeFile(t)}, libstack.Options{ProjectName: "stk02-pull-err"})
	require.Error(t, err)
	require.Contains(t, err.Error(), "compose pull operation failed")
}

func TestREQ_STK_08_Remove_VolumesAndDownError(t *testing.T) {
	var gotDown api.DownOptions
	var gotName string
	w := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				downFn: func(ctx context.Context, projectName string, options api.DownOptions) error {
					gotName = projectName
					gotDown = options
					return nil
				},
			}
		},
	}

	err := w.Remove(t.Context(), "stk08-project", nil, libstack.RemoveOptions{Volumes: true})
	require.NoError(t, err)
	require.Equal(t, "stk08-project", gotName)
	require.True(t, gotDown.RemoveOrphans)
	require.True(t, gotDown.Volumes)

	wErr := ComposeDeployer{
		createComposeServiceFn: func(command.Cli, ...compose.Option) api.Compose {
			return &mockComposeService{
				downFn: func(ctx context.Context, projectName string, options api.DownOptions) error {
					return errors.New("down boom")
				},
			}
		},
	}
	err = wErr.Remove(t.Context(), "stk08-err", nil, libstack.RemoveOptions{})
	require.Error(t, err)
	require.Contains(t, err.Error(), "compose down operation failed")
}

func TestREQ_STK_02_addServiceLabels_Local(t *testing.T) {
	project := &types.Project{
		Name:        "labels-proj",
		WorkingDir:  "/tmp/proj",
		ComposeFiles: []string{"/tmp/proj/docker-compose.yml"},
		Services: types.Services{
			"web": {Name: "web"},
			"db":  {Name: "db"},
		},
	}

	addServiceLabels(project, false, 0)
	for _, name := range []string{"web", "db"} {
		labels := project.Services[name].CustomLabels
		require.Equal(t, "labels-proj", labels[api.ProjectLabel])
		require.Equal(t, name, labels[api.ServiceLabel])
		require.Equal(t, api.ComposeVersion, labels[api.VersionLabel])
		require.Equal(t, "/tmp/proj", labels[api.WorkingDirLabel])
		require.Equal(t, "/tmp/proj/docker-compose.yml", labels[api.ConfigFilesLabel])
		require.Equal(t, "False", labels[api.OneoffLabel])
		_, hasEdge := labels[PortainerEdgeStackLabel]
		require.False(t, hasEdge, "edge label deferred within package")
	}

	addServiceLabels(project, true, 0)
	require.Equal(t, "True", project.Services["web"].CustomLabels[api.OneoffLabel])
}

func TestREQ_STK_02_withComposeService_InvalidParallelLimit(t *testing.T) {
	w := ComposeDeployer{createComposeServiceFn: createMockComposeService}
	path := writeComposeFile(t)
	err := w.withComposeService(t.Context(), []string{path}, libstack.Options{
		ProjectName: "bad-parallel",
		Env:         []string{cmdcompose.ComposeParallelLimit + "=not-an-int"},
	}, func(api.Compose, *types.Project) error { return nil })
	require.Error(t, err)
	require.Contains(t, err.Error(), cmdcompose.ComposeParallelLimit)
}

func TestREQ_STK_02_Config_Success(t *testing.T) {
	w := ComposeDeployer{createComposeServiceFn: createMockComposeService}
	payload, err := w.Config(t.Context(), []string{writeComposeFile(t)}, libstack.Options{ProjectName: "cfg"})
	require.NoError(t, err)
	require.Contains(t, string(payload), "web")
	require.Contains(t, string(payload), "alpine:latest")
}

