package settings

import (
	"net/http"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/pkg/featureflags"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"
	"github.com/portainer/portainer/pkg/libhttp/response"
)

type publicSettingsResponse struct {
	// URL to a logo that will be displayed on top of the sidebar. Will use default Portainer logo when value is empty string
	LogoURL string `json:"LogoURL" example:"https://mycompany.mydomain.tld/logo.png"`
	// Deployment options for encouraging deployment as code
	GlobalDeploymentOptions portainer.GlobalDeploymentOptions `json:"GlobalDeploymentOptions"`
	// Supported feature flags
	Features map[featureflags.Feature]bool `json:"Features"`

	IsDockerDesktopExtension bool `json:"IsDockerDesktopExtension" example:"false"`
}

// @id SettingsPublic
// @summary Retrieve Portainer public settings
// @description Retrieve public settings. Returns a small set of settings that are not reserved to administrators only.
// @description **Access policy**: public
// @tags settings
// @produce json
// @success 200 {object} publicSettingsResponse "Success"
// @failure 500 "Server error"
// @router /settings/public [get]
func (handler *Handler) settingsPublic(w http.ResponseWriter, r *http.Request) *httperror.HandlerError {
	settings, err := handler.DataStore.Settings().Settings()
	if err != nil {
		return httperror.InternalServerError("Unable to retrieve the settings from the database", err)
	}

	publicSettings := generatePublicSettings(settings)

	return response.JSON(w, publicSettings)
}

func generatePublicSettings(appSettings *portainer.Settings) *publicSettingsResponse {
	publicSettings := &publicSettingsResponse{
		LogoURL:                 appSettings.LogoURL,
		GlobalDeploymentOptions: appSettings.GlobalDeploymentOptions,
		Features:                featureflags.FeatureFlags(),
	}

	publicSettings.IsDockerDesktopExtension = appSettings.IsDockerDesktopExtension

	return publicSettings
}
