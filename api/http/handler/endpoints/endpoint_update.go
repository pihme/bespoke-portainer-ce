package endpoints

import (
	"cmp"
	"net/http"
	"reflect"
	"strconv"
	"strings"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/internal/endpointutils"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"
	"github.com/portainer/portainer/pkg/libhttp/request"
	"github.com/portainer/portainer/pkg/libhttp/response"

	"github.com/rs/zerolog/log"
)

type endpointUpdatePayload struct {
	// Name that will be used to identify this environment(endpoint)
	Name *string `example:"my-environment"`
	// URL or IP address of a Docker host
	URL *string `example:"docker.mydomain.tld:2375"`
	// URL or IP address where exposed containers will be reachable.\
	// Defaults to URL if not specified
	PublicURL *string `example:"docker.mydomain.tld:2375"`
	// GPUs information
	Gpus []portainer.Pair
	// Require TLS to connect against this environment(endpoint)
	TLS *bool `example:"true"`
	// Skip server verification when using TLS
	TLSSkipVerify *bool `example:"false"`
	// Skip client verification when using TLS
	TLSSkipClientVerify *bool `example:"false"`
	// The status of the environment(endpoint) (1 - up, 2 - down)
	Status             *int `example:"1"`
	UserAccessPolicies portainer.UserAccessPolicies
	TeamAccessPolicies portainer.TeamAccessPolicies
}

func (payload *endpointUpdatePayload) Validate(r *http.Request) error {
	return nil
}

// @id EndpointUpdate
// @summary Update an environment(endpoint)
// @description Update an environment(endpoint).
// @description **Access policy**: authenticated
// @tags endpoints
// @accept json
// @produce json
// @param id path int true "Environment(Endpoint) identifier"
// @param body body endpointUpdatePayload true "Environment(Endpoint) details"
// @success 200 {object} portainer.Endpoint "Success"
// @failure 400 "Invalid request"
// @failure 404 "Environment(Endpoint) not found"
// @failure 409 "Name is not unique"
// @failure 500 "Server error"
// @router /endpoints/{id} [put]
func (handler *Handler) endpointUpdate(w http.ResponseWriter, r *http.Request) *httperror.HandlerError {
	endpointID, err := request.RetrieveNumericRouteVariableValue(r, "id")
	if err != nil {
		return httperror.BadRequest("Invalid environment identifier route variable", err)
	}

	var payload endpointUpdatePayload
	if err := request.DecodeAndValidateJSONPayload(r, &payload); err != nil {
		return httperror.BadRequest("Invalid request payload", err)
	}

	endpoint, err := handler.DataStore.Endpoint().Endpoint(portainer.EndpointID(endpointID))
	if handler.DataStore.IsErrObjectNotFound(err) {
		return httperror.NotFound("Unable to find an environment with the specified identifier inside the database", err)
	} else if err != nil {
		return httperror.InternalServerError("Unable to find an environment with the specified identifier inside the database", err)
	}

	if payload.TLS != nil && *payload.TLS && endpointutils.IsEdgeEndpoint(endpoint) {
		return httperror.BadRequest("TLS is not supported for Edge Agent environments", nil)
	}

	updateEndpointProxy := shouldReloadTLSConfiguration(endpoint, &payload)

	if payload.Name != nil {
		name := *payload.Name
		if isUnique, err := handler.isNameUnique(name, endpoint.ID); err != nil {
			return httperror.InternalServerError("Unable to check if name is unique", err)
		} else if !isUnique {
			return httperror.Conflict("Name is not unique", nil)
		}

		endpoint.Name = name
	}

	if payload.URL != nil && *payload.URL != endpoint.URL {
		if !portainer.IsLocalSocketURL(*payload.URL) {
			return httperror.BadRequest(portainer.ErrRemoteEnvironmentNotSupported.Error(), portainer.ErrRemoteEnvironmentNotSupported)
		}

		endpoint.URL = *payload.URL
		updateEndpointProxy = true
	}

	if payload.Gpus != nil {
		endpoint.Gpus = payload.Gpus
	}

	endpoint.PublicURL = *cmp.Or(payload.PublicURL, &endpoint.PublicURL)

	// Environment groups and tags are removed (TAI-013): an update keeps the
	// stored GroupID and TagIDs.

	if payload.UserAccessPolicies != nil && !reflect.DeepEqual(payload.UserAccessPolicies, endpoint.UserAccessPolicies) {
		endpoint.UserAccessPolicies = payload.UserAccessPolicies
	}

	if payload.TeamAccessPolicies != nil && !reflect.DeepEqual(payload.TeamAccessPolicies, endpoint.TeamAccessPolicies) {
		endpoint.TeamAccessPolicies = payload.TeamAccessPolicies
	}

	if payload.Status != nil {
		switch *payload.Status {
		case 1:
			endpoint.Status = portainer.EndpointStatusUp
		case 2:
			endpoint.Status = portainer.EndpointStatusDown
		}
	}

	if payload.TLS != nil {
		folder := strconv.Itoa(endpointID)

		if *payload.TLS {
			endpoint.TLSConfig.TLS = true
			if payload.TLSSkipVerify != nil {
				endpoint.TLSConfig.TLSSkipVerify = *payload.TLSSkipVerify

				if !*payload.TLSSkipVerify {
					caCertPath, _ := handler.FileService.GetPathForTLSFile(folder, portainer.TLSFileCA)
					endpoint.TLSConfig.TLSCACertPath = caCertPath
				} else {
					endpoint.TLSConfig.TLSCACertPath = ""

					if err := handler.FileService.DeleteTLSFile(folder, portainer.TLSFileCA); err != nil {
						log.Warn().Err(err).Msg("Unable to remove CA cert from disk")
					}
				}
			}

			if payload.TLSSkipClientVerify != nil {
				if !*payload.TLSSkipClientVerify {
					certPath, _ := handler.FileService.GetPathForTLSFile(folder, portainer.TLSFileCert)
					endpoint.TLSConfig.TLSCertPath = certPath
					keyPath, _ := handler.FileService.GetPathForTLSFile(folder, portainer.TLSFileKey)
					endpoint.TLSConfig.TLSKeyPath = keyPath
				} else {
					endpoint.TLSConfig.TLSCertPath = ""
					if err := handler.FileService.DeleteTLSFile(folder, portainer.TLSFileCert); err != nil {
						log.Warn().Err(err).Msg("Unable to remove TLS cert from disk")
					}

					endpoint.TLSConfig.TLSKeyPath = ""
					if err := handler.FileService.DeleteTLSFile(folder, portainer.TLSFileKey); err != nil {
						log.Warn().Err(err).Msg("Unable to remove TLS key from disk")
					}
				}
			}
		} else {
			endpoint.TLSConfig.TLS = false
			endpoint.TLSConfig.TLSSkipVerify = false
			endpoint.TLSConfig.TLSCACertPath = ""
			endpoint.TLSConfig.TLSCertPath = ""
			endpoint.TLSConfig.TLSKeyPath = ""

			if err := handler.FileService.DeleteTLSFiles(folder); err != nil {
				return httperror.InternalServerError("Unable to remove TLS files from disk", err)
			}
		}
	}

	if updateEndpointProxy {
		handler.ProxyManager.DeleteEndpointProxy(endpoint.ID)

		if _, err := handler.ProxyManager.CreateAndRegisterEndpointProxy(endpoint); err != nil {
			return httperror.InternalServerError("Unable to register HTTP proxy for the environment", err)
		}
	}

	if err := handler.DataStore.Endpoint().UpdateEndpoint(endpoint.ID, endpoint); err != nil {
		return httperror.InternalServerError("Unable to persist environment changes inside the database", err)
	}

	if err := handler.SnapshotService.FillSnapshotData(endpoint, true); err != nil {
		return httperror.InternalServerError("Unable to add snapshot data", err)
	}

	return response.JSON(w, endpoint)
}

func shouldReloadTLSConfiguration(endpoint *portainer.Endpoint, payload *endpointUpdatePayload) bool {
	// If we change anything in the tls config then we need to reload the proxy
	if payload.TLS != nil && endpoint.TLSConfig.TLS != *payload.TLS {
		return true
	}

	// When updating Docker API environment, as long as TLS is true and TLSSkipVerify is false,
	// we assume that new TLS files have been uploaded and we need to reload the TLS configuration.
	if endpoint.Type != portainer.DockerEnvironment ||
		(payload.URL != nil && !strings.HasPrefix(*payload.URL, "tcp://")) ||
		payload.TLS == nil || !*payload.TLS {
		return false
	}

	if payload.TLSSkipVerify != nil && !*payload.TLSSkipVerify {
		return true
	}

	return payload.TLSSkipClientVerify != nil && !*payload.TLSSkipClientVerify
}
