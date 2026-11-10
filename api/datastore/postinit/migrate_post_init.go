package postinit

import (
	"context"
	"fmt"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	dockerClient "github.com/portainer/portainer/api/docker/client"
	"github.com/portainer/portainer/api/internal/endpointutils"
	"github.com/portainer/portainer/api/logs"
	"github.com/portainer/portainer/pkg/endpoints"

	"github.com/rs/zerolog/log"
)

type PostInitMigrator struct {
	dockerFactory *dockerClient.ClientFactory
	dataStore     dataservices.DataStore
}

func NewPostInitMigrator(
	dockerFactory *dockerClient.ClientFactory,
	dataStore dataservices.DataStore,
) *PostInitMigrator {
	return &PostInitMigrator{
		dockerFactory: dockerFactory,
		dataStore:     dataStore,
	}
}

// PostInitMigrate runs the post-init migrations, which need a Docker client, for every directly connected environment
func (postInitMigrator *PostInitMigrator) PostInitMigrate() error {
	var environments []portainer.Endpoint

	if err := postInitMigrator.dataStore.ViewTx(func(tx dataservices.DataStoreTx) error {
		var err error
		if environments, err = tx.Endpoint().ReadAll(func(endpoint portainer.Endpoint) bool {
			return endpoints.HasDirectConnectivity(&endpoint)
		}); err != nil {
			return fmt.Errorf("failed to retrieve environments: %w", err)
		}

		return nil
	}); err != nil {
		log.Error().Err(err).Msg("error running post-init migrations")

		return err
	}

	for _, environment := range environments {
		if endpoints.IsEdgeEndpoint(&environment) {
			continue
		}

		// Non-edge environments will run before the server starts.
		if err := postInitMigrator.MigrateEnvironment(&environment); err != nil {
			log.Error().
				Err(err).
				Int("endpoint_id", int(environment.ID)).
				Msg("error running post-init migrations for non-edge environment")
		}
	}

	return nil
}

// MigrateEnvironment runs migrations on a single environment
func (migrator *PostInitMigrator) MigrateEnvironment(environment *portainer.Endpoint) error {
	log.Info().
		Int("endpoint_id", int(environment.ID)).
		Msg("executing post init migration for environment")

	switch {
	case endpointutils.IsDockerEndpoint(environment):
		// get the docker client for the environment, and skip all docker migrations if there's an error
		dockerClient, err := migrator.dockerFactory.CreateClient(environment, nil)
		if err != nil {
			log.Error().
				Err(err).
				Int("endpoint_id", int(environment.ID)).
				Msg("error creating docker client for environment")

			return err
		}
		defer logs.CloseAndLogErr(dockerClient)

		if err := migrator.MigrateGPUs(*environment, dockerClient); err != nil {
			log.Error().
				Err(err).
				Int("endpoint_id", int(environment.ID)).
				Msg("error migrating GPUs for environment")

			return err
		}
	}

	return nil
}

// MigrateGPUs will check all docker endpoints for containers with GPUs and set EnableGPUManagement to true if any are found
// If there's an error getting the containers, we'll log it and move on
func (migrator *PostInitMigrator) MigrateGPUs(e portainer.Endpoint, dockerClient *client.Client) error {
	return migrator.dataStore.UpdateTx(func(tx dataservices.DataStoreTx) error {
		environment, err := tx.Endpoint().Endpoint(e.ID)
		if err != nil {
			log.Error().
				Err(err).
				Int("endpoint_id", int(e.ID)).
				Msg("error getting environment")

			return err
		}

		// Early exit if we do not need to migrate!
		if !environment.PostInitMigrations.MigrateGPUs {
			return nil
		}

		log.Debug().
			Int("endpoint_id", int(e.ID)).
			Msg("migrating GPUs for environment")

		// Get all containers
		containers, err := dockerClient.ContainerList(context.Background(), container.ListOptions{All: true})
		if err != nil {
			log.Error().
				Err(err).
				Int("endpoint_id", int(environment.ID)).
				Msg("failed to list containers for environment")

			return err
		}

		// Check for a gpu on each container. If even one GPU is found, set EnableGPUManagement to true for the whole environment
	containersLoop:
		for _, container := range containers {
			// https://www.sobyte.net/post/2022-10/go-docker/ has nice documentation on the docker client with GPUs
			containerDetails, err := dockerClient.ContainerInspect(context.Background(), container.ID)
			if err != nil {
				log.Error().Err(err).Msg("failed to inspect container")

				continue
			}

			deviceRequests := containerDetails.HostConfig.DeviceRequests
			for _, deviceRequest := range deviceRequests {
				if deviceRequest.Driver == "nvidia" {
					environment.EnableGPUManagement = true

					break containersLoop
				}
			}
		}

		// Set the MigrateGPUs flag to false so we don't run this again
		environment.PostInitMigrations.MigrateGPUs = false
		if err := tx.Endpoint().UpdateEndpoint(environment.ID, environment); err != nil {
			log.Error().
				Err(err).
				Int("endpoint_id", int(environment.ID)).
				Msg("error updating EnableGPUManagement flag for environment")

			return err
		}

		return nil
	})
}
