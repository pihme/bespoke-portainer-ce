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
	// Whether edge compute features are enabled
	EnableEdgeComputeFeatures bool `json:"EnableEdgeComputeFeatures" example:"true"`
	// Supported feature flags
	Features map[featureflags.Feature]bool `json:"Features"`
	// The expiry of a Kubeconfig
	KubeconfigExpiry string `example:"24h" default:"0"`

	Edge struct {
		// The ping interval for edge agent - used in edge async mode [seconds]
		PingInterval int `json:"PingInterval" example:"60"`
		// The snapshot interval for edge agent - used in edge async mode [seconds]
		SnapshotInterval int `json:"SnapshotInterval" example:"60"`
		// The command list interval for edge agent - used in edge async mode [seconds]
		CommandInterval int `json:"CommandInterval" example:"60"`
		// The check in interval for edge agent (in seconds) - used in non async mode [seconds]
		CheckinInterval int `example:"60"`
	}

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
		LogoURL:                   appSettings.LogoURL,
		EnableEdgeComputeFeatures: appSettings.EnableEdgeComputeFeatures,
		GlobalDeploymentOptions:   appSettings.GlobalDeploymentOptions,
		KubeconfigExpiry:          appSettings.KubeconfigExpiry,
		Features:                  featureflags.FeatureFlags(),
	}

	publicSettings.Edge.PingInterval = appSettings.Edge.PingInterval
	publicSettings.Edge.SnapshotInterval = appSettings.Edge.SnapshotInterval
	publicSettings.Edge.CommandInterval = appSettings.Edge.CommandInterval
	publicSettings.Edge.CheckinInterval = appSettings.EdgeAgentCheckinInterval

	publicSettings.IsDockerDesktopExtension = appSettings.IsDockerDesktopExtension

	return publicSettings
}
