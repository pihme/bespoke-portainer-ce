package migrator

import (
	"os"
	"time"

	portainer "github.com/portainer/portainer/api"

	"github.com/rs/zerolog/log"
)

func (m *Migrator) migrateDockerDesktopExtensionSetting() error {
	log.Info().Msg("updating docker desktop extension flag in settings")

	isDDExtension := false
	if _, ok := os.LookupEnv("DOCKER_EXTENSION"); ok {
		isDDExtension = true
	}

	settings, err := m.settingsService.Settings()
	if err != nil {
		return err
	}

	settings.IsDockerDesktopExtension = isDDExtension

	return m.settingsService.UpdateSettings(settings)
}

func (m *Migrator) updateEdgeStackStatusForDB100() error {
	log.Info().Msg("update edge stack status to have deployment steps")

	edgeStacks, err := m.edgeStackService.EdgeStacks()
	if err != nil {
		return err
	}

	for _, edgeStack := range edgeStacks {
		for environmentID, environmentStatus := range edgeStack.Status {
			// Skip if status is already updated
			if len(environmentStatus.Status) > 0 {
				continue
			}

			if environmentStatus.Details == nil {
				continue
			}

			statusArray := []portainer.EdgeStackDeploymentStatus{}
			if environmentStatus.Details.Pending {
				statusArray = append(statusArray, portainer.EdgeStackDeploymentStatus{
					Type: portainer.EdgeStackStatusPending,
					Time: time.Now().Unix(),
				})
			}

			if environmentStatus.Details.Acknowledged {
				statusArray = append(statusArray, portainer.EdgeStackDeploymentStatus{
					Type: portainer.EdgeStackStatusAcknowledged,
					Time: time.Now().Unix(),
				})
			}

			if environmentStatus.Details.Error {
				statusArray = append(statusArray, portainer.EdgeStackDeploymentStatus{
					Type:  portainer.EdgeStackStatusError,
					Error: environmentStatus.Error,
					Time:  time.Now().Unix(),
				})
			}

			if environmentStatus.Details.Ok {
				statusArray = append(statusArray,
					portainer.EdgeStackDeploymentStatus{
						Type: portainer.EdgeStackStatusDeploymentReceived,
						Time: time.Now().Unix(),
					},
					portainer.EdgeStackDeploymentStatus{
						Type: portainer.EdgeStackStatusRunning,
						Time: time.Now().Unix(),
					},
				)
			}

			if environmentStatus.Details.ImagesPulled {
				statusArray = append(statusArray, portainer.EdgeStackDeploymentStatus{
					Type: portainer.EdgeStackStatusImagesPulled,
					Time: time.Now().Unix(),
				})
			}

			if environmentStatus.Details.Remove {
				statusArray = append(statusArray, portainer.EdgeStackDeploymentStatus{
					Type: portainer.EdgeStackStatusRemoving,
					Time: time.Now().Unix(),
				})
			}

			environmentStatus.Status = statusArray

			edgeStack.Status[environmentID] = environmentStatus
		}

		if err := m.edgeStackService.UpdateEdgeStack(edgeStack.ID, &edgeStack); err != nil {
			return err
		}
	}

	return nil
}
