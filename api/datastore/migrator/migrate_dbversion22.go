package migrator

import (
	portainer "github.com/portainer/portainer/api"

	"github.com/rs/zerolog/log"
)

// updateEndpointsAndEndpointGroupsToDBVersion23 converts the legacy tag names
// of environments and environment groups to tag IDs. There is no tags
// collection (TAI-023), so no name resolves and every environment and group
// gets an empty tag ID list, as it did when the collection was empty.
func (m *Migrator) updateEndpointsAndEndpointGroupsToDBVersion23() error {
	log.Info().Msg("updating endpoints and endpoint groups")

	endpoints, err := m.endpointService.Endpoints()
	if err != nil {
		return err
	}

	for _, endpoint := range endpoints {
		endpoint.TagIDs = make([]portainer.TagID, 0)
		err = m.endpointService.UpdateEndpoint(endpoint.ID, &endpoint)
		if err != nil {
			return err
		}
	}

	endpointGroups, err := m.endpointGroupService.ReadAll()
	if err != nil {
		return err
	}

	for _, endpointGroup := range endpointGroups {
		endpointGroup.TagIDs = make([]portainer.TagID, 0)
		err = m.endpointGroupService.Update(endpointGroup.ID, &endpointGroup)
		if err != nil {
			return err
		}
	}

	return nil
}
