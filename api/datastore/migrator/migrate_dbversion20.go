package migrator

import (
	"github.com/portainer/portainer/api/internal/authorization"

	"github.com/rs/zerolog/log"
)

func (m *Migrator) updateResourceControlsToDBVersion22() error {
	log.Info().Msg("updating resource controls")

	legacyResourceControls, err := m.resourceControlService.ReadAll()
	if err != nil {
		return err
	}

	for _, resourceControl := range legacyResourceControls {
		resourceControl.AdministratorsOnly = false

		if err := m.resourceControlService.Update(resourceControl.ID, &resourceControl); err != nil {
			return err
		}
	}

	return nil
}

func (m *Migrator) updateUsersToDBVersion22() error {
	log.Info().Msg("updating users")

	legacyUsers, err := m.userService.ReadAll()
	if err != nil {
		return err
	}

	for _, user := range legacyUsers {
		user.PortainerAuthorizations = authorization.DefaultPortainerAuthorizations()

		if err := m.userService.Update(user.ID, &user); err != nil {
			return err
		}
	}

	return m.authorizationService.UpdateUsersAuthorizations()
}
