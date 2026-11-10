package migrator

import (
	"github.com/portainer/portainer/api/internal/endpointutils"

	"github.com/rs/zerolog/log"
)

func (m *Migrator) migrateDBVersionToDB80() error {
	if err := m.updateExistingEndpointsToNotDetectMetricsAPIForDB80(); err != nil {
		return err
	}

	if err := m.updateExistingEndpointsToNotDetectStorageAPIForDB80(); err != nil {
		return err
	}

	return nil
}

func (m *Migrator) updateExistingEndpointsToNotDetectMetricsAPIForDB80() error {
	log.Info().Msg("updating existing endpoints to not detect metrics API for existing endpoints (k8s)")

	endpoints, err := m.endpointService.Endpoints()
	if err != nil {
		return err
	}

	for _, endpoint := range endpoints {
		if endpointutils.IsKubernetesEndpoint(&endpoint) {
			endpoint.Kubernetes.Flags.IsServerMetricsDetected = true
			err = m.endpointService.UpdateEndpoint(endpoint.ID, &endpoint)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func (m *Migrator) updateExistingEndpointsToNotDetectStorageAPIForDB80() error {
	log.Info().Msg("updating existing endpoints to not detect metrics API for existing endpoints (k8s)")

	endpoints, err := m.endpointService.Endpoints()
	if err != nil {
		return err
	}

	for _, endpoint := range endpoints {
		if endpointutils.IsKubernetesEndpoint(&endpoint) {
			endpoint.Kubernetes.Flags.IsServerStorageDetected = true
			err = m.endpointService.UpdateEndpoint(endpoint.ID, &endpoint)
			if err != nil {
				return err
			}
		}
	}

	return nil
}
