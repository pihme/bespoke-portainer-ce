package migrator

import (
	"fmt"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/internal/endpointutils"
	snapshotutils "github.com/portainer/portainer/api/internal/snapshot"

	"github.com/docker/docker/api/types/volume"
	"github.com/rs/zerolog/log"
)

func (m *Migrator) migrateDBVersionToDB32() error {
	err := m.updateRegistriesToDB32()
	if err != nil {
		return err
	}

	if err := m.updateVolumeResourceControlToDB32(); err != nil {
		return err
	}

	if err := m.kubeconfigExpiryToDB32(); err != nil {
		return err
	}

	if err := m.helmRepositoryURLToDB32(); err != nil {
		return err
	}

	return nil
}

func (m *Migrator) updateRegistriesToDB32() error {
	log.Info().Msg("updating registries")

	registries, err := m.registryService.ReadAll()
	if err != nil {
		return err
	}

	endpoints, err := m.endpointService.Endpoints()
	if err != nil {
		return err
	}

	for _, registry := range registries {

		registry.RegistryAccesses = portainer.RegistryAccesses{}

		for _, endpoint := range endpoints {

			filteredUserAccessPolicies := portainer.UserAccessPolicies{}
			for userId, registryPolicy := range registry.UserAccessPolicies {
				if _, found := endpoint.UserAccessPolicies[userId]; found {
					filteredUserAccessPolicies[userId] = registryPolicy
				}
			}

			filteredTeamAccessPolicies := portainer.TeamAccessPolicies{}
			for teamId, registryPolicy := range registry.TeamAccessPolicies {
				if _, found := endpoint.TeamAccessPolicies[teamId]; found {
					filteredTeamAccessPolicies[teamId] = registryPolicy
				}
			}

			registry.RegistryAccesses[endpoint.ID] = portainer.RegistryAccessPolicies{
				UserAccessPolicies: filteredUserAccessPolicies,
				TeamAccessPolicies: filteredTeamAccessPolicies,
				Namespaces:         []string{},
			}
		}

		if err := m.registryService.Update(registry.ID, &registry); err != nil {
			return err
		}
	}

	return nil
}

func (m *Migrator) updateVolumeResourceControlToDB32() error {
	log.Info().Msg("updating resource controls")

	endpoints, err := m.endpointService.Endpoints()
	if err != nil {
		return fmt.Errorf("failed fetching environments: %w", err)
	}

	resourceControls, err := m.resourceControlService.ReadAll()
	if err != nil {
		return fmt.Errorf("failed fetching resource controls: %w", err)
	}

	toUpdate := map[portainer.ResourceControlID]string{}
	volumeResourceControls := map[string]*portainer.ResourceControl{}

	for i := range resourceControls {
		resourceControl := resourceControls[i]
		if resourceControl.Type == portainer.VolumeResourceControl {
			volumeResourceControls[resourceControl.ResourceID] = &resourceControl
		}
	}

	for _, endpoint := range endpoints {
		if !endpointutils.IsDockerEndpoint(&endpoint) {
			continue
		}

		totalSnapshots := len(endpoint.Snapshots)
		if totalSnapshots == 0 {
			log.Debug().Msg("no snapshot found")
			continue
		}

		snapshot := endpoint.Snapshots[totalSnapshots-1]

		endpointDockerID, err := snapshotutils.FetchDockerID(snapshot)
		if err != nil {
			log.Warn().Err(err).Msg("failed fetching environment docker id")
			continue
		}

		volumesData := snapshot.SnapshotRaw.Volumes
		if volumesData.Volumes == nil {
			log.Debug().Msg("no volume data found")
			continue
		}

		findResourcesToUpdateForDB32(endpointDockerID, volumesData, toUpdate, volumeResourceControls)

	}

	for _, resourceControl := range volumeResourceControls {
		if newResourceID, ok := toUpdate[resourceControl.ID]; ok {
			resourceControl.ResourceID = newResourceID

			err := m.resourceControlService.Update(resourceControl.ID, resourceControl)
			if err != nil {
				return fmt.Errorf("failed updating resource control %d: %w", resourceControl.ID, err)
			}
		} else {
			err := m.resourceControlService.Delete(resourceControl.ID)
			if err != nil {
				return fmt.Errorf("failed deleting resource control %d: %w", resourceControl.ID, err)
			}

			log.Debug().Str("resource_id", resourceControl.ResourceID).Msg("legacy resource control has been deleted")
		}
	}

	return nil
}

func findResourcesToUpdateForDB32(dockerID string, volumesData volume.ListResponse, toUpdate map[portainer.ResourceControlID]string, volumeResourceControls map[string]*portainer.ResourceControl) {
	volumes := volumesData.Volumes
	for _, volume := range volumes {
		volumeName := volume.Name
		createTime := volume.CreatedAt

		oldResourceID := fmt.Sprintf("%s%s", volumeName, createTime)
		resourceControl, ok := volumeResourceControls[oldResourceID]

		if ok {
			toUpdate[resourceControl.ID] = fmt.Sprintf("%s_%s", volumeName, dockerID)
		}
	}
}

func (m *Migrator) kubeconfigExpiryToDB32() error {
	log.Info().Msg("updating kubeconfig expiry")

	settings, err := m.settingsService.Settings()
	if err != nil {
		return err
	}

	settings.KubeconfigExpiry = portainer.DefaultKubeconfigExpiry
	return m.settingsService.UpdateSettings(settings)
}

func (m *Migrator) helmRepositoryURLToDB32() error {
	log.Info().Msg("setting default helm repository URL")

	settings, err := m.settingsService.Settings()
	if err != nil {
		return err
	}

	settings.HelmRepositoryURL = portainer.DefaultHelmRepositoryURL
	return m.settingsService.UpdateSettings(settings)
}
