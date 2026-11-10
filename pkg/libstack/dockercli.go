package libstack

import (
	"context"
	"fmt"
	"maps"
	"sync"

	"github.com/portainer/portainer/api/logs"

	"github.com/docker/cli/cli/command"
	"github.com/docker/cli/cli/flags"
	"github.com/rs/zerolog/log"
)

// DockerCliOptions holds the settings required to initialise a DockerCli.
type DockerCliOptions struct {
	Host string
	// Headers are injected as custom HTTP headers on every request the client makes.
	Headers map[string]string
}

// mu serialises calls to cli.Initialize across all deployer types (compose and
// swarm) to prevent concurrent initialisation of the Docker client config.
var mu sync.Mutex

// WithCli creates and initialises a DockerCli and calls cliFn with the ready client. The client is closed after cliFn returns.
func WithCli(
	ctx context.Context, //nolint:staticcheck
	options DockerCliOptions,
	cliFn func(context.Context, *command.DockerCli) error,
) error {
	ctx = context.Background() //nolint:staticcheck

	cli, err := command.NewDockerCli(command.WithCombinedStreams(log.Logger))
	if err != nil {
		return fmt.Errorf("unable to create a Docker client: %w", err)
	}

	opts := flags.NewClientOptions()
	if options.Host != "" {
		opts.Hosts = []string{options.Host}
	}

	mu.Lock()
	if err := cli.Initialize(opts); err != nil {
		mu.Unlock()
		return fmt.Errorf("unable to initialize the Docker client: %w", err)
	}
	mu.Unlock()

	// Inject custom headers before the first Client() call, which is where the
	// Docker client is lazily created and reads ConfigFile().HTTPHeaders.
	if len(options.Headers) > 0 {
		cfg := cli.ConfigFile()
		if cfg.HTTPHeaders == nil {
			cfg.HTTPHeaders = make(map[string]string)
		}
		maps.Copy(cfg.HTTPHeaders, options.Headers)
	}

	defer logs.CloseAndLogErr(cli.Client())

	return cliFn(ctx, cli)
}
