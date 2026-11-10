package migrator

import (
	"os"

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
