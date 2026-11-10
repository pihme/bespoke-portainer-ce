package migrator

import (
	"github.com/rs/zerolog/log"
)

func (m *Migrator) updateUsersToDBVersion20() error {
	log.Info().Msg("updating user authentication")

	return m.authorizationService.UpdateUsersAuthorizations()
}

func (m *Migrator) updateSettingsToDBVersion20() error {
	log.Info().Msg("updating settings")
	legacySettings, err := m.settingsService.Settings()
	if err != nil {
		return err
	}

	legacySettings.AllowVolumeBrowserForRegularUsers = false

	return m.settingsService.UpdateSettings(legacySettings)
}
