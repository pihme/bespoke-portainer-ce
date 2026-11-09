package settings

import (
	"cmp"
	"net/http"
	"strings"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/internal/edge"
	"github.com/portainer/portainer/pkg/libhelm"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"
	"github.com/portainer/portainer/pkg/libhttp/request"
	"github.com/portainer/portainer/pkg/libhttp/response"
	"github.com/portainer/portainer/pkg/libhttp/ssrf"
	"github.com/portainer/portainer/pkg/validate"

	"github.com/pkg/errors"
)

type settingsUpdatePayload struct {
	// URL to a logo that will be displayed on the login page as well as on top of the sidebar. Will use default Portainer logo when value is empty string
	LogoURL *string `example:"https://mycompany.mydomain.tld/logo.png"`
	// A list of label name & value that will be used to hide containers when querying containers
	BlackListedLabels []portainer.Pair
	// The interval in which environment(endpoint) snapshots are created
	SnapshotInterval *string `example:"5m"`
	// URL to the templates that will be displayed in the UI when navigating to App Templates
	TemplatesURL *string `example:"https://raw.githubusercontent.com/portainer/templates/master/templates.json"`
	// Deployment options for encouraging deployment as code
	GlobalDeploymentOptions  *portainer.GlobalDeploymentOptions // The default check in interval for edge agent (in seconds)
	EdgeAgentCheckinInterval *int                               `example:"5"`
	// Whether edge compute features are enabled
	EnableEdgeComputeFeatures *bool `example:"true"`
	// The expiry of a Kubeconfig
	KubeconfigExpiry *string `example:"24h" default:"0"`
	// Helm repository URL
	HelmRepositoryURL *string `example:"https://charts.bitnami.com/bitnami"`
	// Kubectl Shell Image
	KubectlShellImage *string `example:"portainer/kubectl-shell:latest"`
	// TrustOnFirstConnect makes Portainer accepting edge agent connection by default
	TrustOnFirstConnect *bool `example:"false"`
	// EnforceEdgeID makes Portainer store the Edge ID instead of accepting anyone
	EnforceEdgeID *bool `example:"false"`
	// EdgePortainerURL is the URL that is exposed to edge agents
	EdgePortainerURL *string `json:"EdgePortainerURL"`
	// ForceSecureCookies forces the Secure attribute on auth cookies regardless of the detected scheme
	ForceSecureCookies *bool `example:"false"`
}

func (payload *settingsUpdatePayload) Validate(r *http.Request) error {
	if payload.LogoURL != nil && *payload.LogoURL != "" && !validate.IsURL(*payload.LogoURL) {
		return errors.New("Invalid logo URL. Must correspond to a valid URL format")
	}

	if payload.TemplatesURL != nil && *payload.TemplatesURL != "" && !validate.IsURL(*payload.TemplatesURL) {
		return errors.New("Invalid external templates URL. Must correspond to a valid URL format")
	}

	if payload.HelmRepositoryURL != nil && *payload.HelmRepositoryURL != "" && !validate.IsURL(*payload.HelmRepositoryURL) {
		return errors.New("Invalid Helm repository URL. Must correspond to a valid URL format")
	}

	if payload.HelmRepositoryURL != nil && *payload.HelmRepositoryURL != "" {
		if err := ssrf.CheckURL(r.Context(), *payload.HelmRepositoryURL); err != nil {
			return errors.New("Invalid Helm repository URL. Must correspond to a valid URL format")
		}
	}

	if payload.KubeconfigExpiry != nil {
		if _, err := time.ParseDuration(*payload.KubeconfigExpiry); err != nil {
			return errors.New("Invalid Kubeconfig Expiry")
		}
	}

	if payload.EdgePortainerURL != nil && *payload.EdgePortainerURL != "" {
		if _, err := edge.ParseHostForEdge(*payload.EdgePortainerURL); err != nil {
			return err
		}
	}

	return nil
}

// @id SettingsUpdate
// @summary Update Portainer settings
// @description Update Portainer settings.
// @description **Access policy**: administrator
// @tags settings
// @accept json
// @produce json
// @param body body settingsUpdatePayload true "New settings"
// @success 200 {object} portainer.Settings "Success"
// @failure 400 "Invalid request"
// @failure 500 "Server error"
// @router /settings [put]
func (handler *Handler) settingsUpdate(w http.ResponseWriter, r *http.Request) *httperror.HandlerError {
	var payload settingsUpdatePayload
	err := request.DecodeAndValidateJSONPayload(r, &payload)
	if err != nil {
		return httperror.BadRequest("Invalid request payload", err)
	}

	var settings *portainer.Settings
	if err = handler.DataStore.UpdateTx(func(tx dataservices.DataStoreTx) error {
		settings, err = handler.updateSettings(tx, payload)

		return err
	}); err != nil {
		return response.TxErrorResponse(err)
	}

	hideFields(settings)
	return response.JSON(w, settings)
}

func (handler *Handler) updateSettings(tx dataservices.DataStoreTx, payload settingsUpdatePayload) (*portainer.Settings, error) {
	settings, err := tx.Settings().Settings()
	if err != nil {
		return nil, httperror.InternalServerError("Unable to retrieve the settings from the database", err)
	}

	settings.LogoURL = *cmp.Or(payload.LogoURL, &settings.LogoURL)
	settings.TemplatesURL = *cmp.Or(payload.TemplatesURL, &settings.TemplatesURL)

	// Update the global deployment options, and the environment deployment options if they have changed
	settings.GlobalDeploymentOptions = *cmp.Or(payload.GlobalDeploymentOptions, &settings.GlobalDeploymentOptions)

	if payload.HelmRepositoryURL != nil {
		settings.HelmRepositoryURL = ""
		if *payload.HelmRepositoryURL != "" {
			newHelmRepo := strings.TrimSuffix(strings.ToLower(*payload.HelmRepositoryURL), "/")

			if newHelmRepo != settings.HelmRepositoryURL && newHelmRepo != portainer.DefaultHelmRepositoryURL {
				if err := libhelm.ValidateHelmRepositoryURL(*payload.HelmRepositoryURL, nil); err != nil {
					return nil, httperror.BadRequest("Invalid Helm repository URL. Must correspond to a valid URL format", err)
				}
			}

			settings.HelmRepositoryURL = newHelmRepo
		}
	}

	if payload.BlackListedLabels != nil {
		settings.BlackListedLabels = payload.BlackListedLabels
	}

	settings.EnableEdgeComputeFeatures = *cmp.Or(payload.EnableEdgeComputeFeatures, &settings.EnableEdgeComputeFeatures)
	settings.TrustOnFirstConnect = *cmp.Or(payload.TrustOnFirstConnect, &settings.TrustOnFirstConnect)
	settings.EnforceEdgeID = *cmp.Or(payload.EnforceEdgeID, &settings.EnforceEdgeID)
	settings.EdgePortainerURL = *cmp.Or(payload.EdgePortainerURL, &settings.EdgePortainerURL)
	settings.ForceSecureCookies = *cmp.Or(payload.ForceSecureCookies, &settings.ForceSecureCookies)

	if payload.SnapshotInterval != nil && *payload.SnapshotInterval != settings.SnapshotInterval {
		if err := handler.updateSnapshotInterval(settings, *payload.SnapshotInterval); err != nil {
			return nil, httperror.InternalServerError("Unable to update snapshot interval", err)
		}
	}

	settings.EdgeAgentCheckinInterval = *cmp.Or(payload.EdgeAgentCheckinInterval, &settings.EdgeAgentCheckinInterval)
	settings.KubeconfigExpiry = *cmp.Or(payload.KubeconfigExpiry, &settings.KubeconfigExpiry)

	settings.KubectlShellImage = *cmp.Or(payload.KubectlShellImage, &settings.KubectlShellImage)

	if err := tx.Settings().UpdateSettings(settings); err != nil {
		return nil, httperror.InternalServerError("Unable to persist settings changes inside the database", err)
	}

	return settings, nil
}

func (handler *Handler) updateSnapshotInterval(settings *portainer.Settings, snapshotInterval string) error {
	settings.SnapshotInterval = snapshotInterval

	return handler.SnapshotService.SetSnapshotInterval(snapshotInterval)
}
