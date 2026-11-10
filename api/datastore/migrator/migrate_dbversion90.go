package migrator

import (
	"github.com/rs/zerolog/log"

	portainer "github.com/portainer/portainer/api"
)

func (m *Migrator) migrateDBVersionToDB90() error {
	if err := m.updateUserThemeForDB90(); err != nil {
		return err
	}

	return m.updateEnableGpuManagementFeatures()
}

func (m *Migrator) updateUserThemeForDB90() error {
	log.Info().Msg("updating existing user theme settings")

	users, err := m.userService.ReadAll()
	if err != nil {
		return err
	}

	for i := range users {
		user := &users[i]
		if user.UserTheme != "" {
			user.ThemeSettings.Color = user.UserTheme
		}

		if err := m.userService.Update(user.ID, user); err != nil {
			return err
		}
	}

	return nil
}

func (m *Migrator) updateEnableGpuManagementFeatures() error {
	// get all environments
	environments, err := m.endpointService.Endpoints()
	if err != nil {
		return err
	}

	for _, environment := range environments {
		if environment.Type == portainer.DockerEnvironment {
			// set the PostInitMigrations.MigrateGPUs to true on this environment to run the migration only on the 2.18 upgrade
			environment.PostInitMigrations.MigrateGPUs = true
			// if there's one or more gpu, set the EnableGpuManagement setting to true
			gpuList := environment.Gpus
			if len(gpuList) > 0 {
				environment.EnableGPUManagement = true
			}
			// update the environment
			if err := m.endpointService.UpdateEndpoint(environment.ID, &environment); err != nil {
				return err
			}
		}
	}
	return nil
}
