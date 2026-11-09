package security

import (
	"context"
	"net/http"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/pkg/featureflags"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"

	"github.com/pkg/errors"
)

type (
	// BouncerService wraps API routes. Portainer has no login: every request
	// is served as the local operator (TAI-001), so the access levels below only
	// add the secure headers and the local operator's request context.
	BouncerService interface {
		PublicAccess(http.Handler) http.Handler
		AdminAccess(http.Handler) http.Handler
		RestrictedAccess(http.Handler) http.Handler
		AuthenticatedAccess(http.Handler) http.Handler
		EdgeComputeOperation(http.Handler) http.Handler

		AuthorizedEndpointOperation(*http.Request, *portainer.Endpoint) error
		AuthorizedEdgeEndpointOperation(*http.Request, *portainer.Endpoint) error
		TrustedEdgeEnvironmentAccess(dataservices.DataStoreTx, *portainer.Endpoint) error
		DisableCSP()
	}

	// RequestBouncer represents an entity that manages API request accesses
	RequestBouncer struct {
		dataStore dataservices.DataStore
		hsts      bool
		csp       bool
	}

	// RestrictedRequestContext is a data structure containing information
	// used in AuthenticatedAccess
	RestrictedRequestContext struct {
		IsAdmin         bool
		IsTeamLeader    bool
		UserID          portainer.UserID
		UserMemberships []portainer.TeamMembership
		User            *portainer.User
	}
)

// NewRequestBouncer initializes a new RequestBouncer
func NewRequestBouncer(ctx context.Context, dataStore dataservices.DataStore) *RequestBouncer {
	return &RequestBouncer{
		dataStore: dataStore,
		hsts:      featureflags.IsEnabled("hsts"),
		csp:       true,
	}
}

// DisableCSP disables Content Security Policy
func (bouncer *RequestBouncer) DisableCSP() {
	bouncer.csp = false
}

// PublicAccess defines a security check for public API endpoints.
// No authentication is required to access these endpoints.
func (bouncer *RequestBouncer) PublicAccess(h http.Handler) http.Handler {
	return MWSecureHeaders(h, bouncer.hsts, bouncer.csp)
}

// AdminAccess serves the request as the local operator.
func (bouncer *RequestBouncer) AdminAccess(h http.Handler) http.Handler {
	return bouncer.mwLocalOperator(h)
}

// RestrictedAccess serves the request as the local operator.
func (bouncer *RequestBouncer) RestrictedAccess(h http.Handler) http.Handler {
	return bouncer.mwLocalOperator(h)
}

// AuthenticatedAccess serves the request as the local operator.
func (bouncer *RequestBouncer) AuthenticatedAccess(h http.Handler) http.Handler {
	return bouncer.mwLocalOperator(h)
}

// AuthorizedEndpointOperation always allows the local operator to reach an environment.
func (bouncer *RequestBouncer) AuthorizedEndpointOperation(r *http.Request, endpoint *portainer.Endpoint) error {
	return nil
}

// AuthorizedEdgeEndpointOperation verifies that the request was received from a valid Edge environment(endpoint)
func (bouncer *RequestBouncer) AuthorizedEdgeEndpointOperation(r *http.Request, endpoint *portainer.Endpoint) error {
	if endpoint.Type != portainer.EdgeAgentOnKubernetesEnvironment && endpoint.Type != portainer.EdgeAgentOnDockerEnvironment {
		return errors.New("Invalid environment type")
	}

	edgeIdentifier := r.Header.Get(portainer.PortainerAgentEdgeIDHeader)
	if edgeIdentifier == "" {
		return errors.New("missing Edge identifier")
	}

	if endpoint.EdgeID != "" && endpoint.EdgeID != edgeIdentifier {
		return errors.New("invalid Edge identifier")
	}

	return nil
}

// TrustedEdgeEnvironmentAccess defines a security check for Edge environments, checks if
// the request is coming from a trusted Edge environment
func (bouncer *RequestBouncer) TrustedEdgeEnvironmentAccess(tx dataservices.DataStoreTx, endpoint *portainer.Endpoint) error {
	if endpoint.UserTrusted {
		return nil
	}

	settings, err := tx.Settings().Settings()
	if err != nil {
		return errors.WithMessage(err, "could not retrieve the settings")
	}

	if !settings.TrustOnFirstConnect {
		return errors.New("the device has not been trusted yet")
	}

	return nil
}

// mwLocalOperator adds the secure headers and stores the local operator in the
// request context. Credentials sent with the request are ignored.
func (bouncer *RequestBouncer) mwLocalOperator(next http.Handler) http.Handler {
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, err := LocalOperator(bouncer.dataStore)
		if err != nil {
			httperror.WriteError(w, http.StatusInternalServerError, "Unable to retrieve the local operator", err)

			return
		}

		ctx := StoreTokenData(r, &portainer.TokenData{
			ID:       user.ID,
			Username: user.Username,
			Role:     portainer.AdministratorRole,
		})
		r = r.WithContext(ctx)

		ctx = StoreRestrictedRequestContext(r, &RestrictedRequestContext{
			IsAdmin: true,
			UserID:  user.ID,
			User:    user,
		})

		next.ServeHTTP(w, r.WithContext(ctx))
	})

	return MWSecureHeaders(h, bouncer.hsts, bouncer.csp)
}

// MWSecureHeaders provides secure headers middleware for handlers.
func MWSecureHeaders(next http.Handler, hsts, csp bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if hsts {
			w.Header().Set("Strict-Transport-Security", "max-age=31536000") // 365 days
		}

		if csp {
			w.Header().Set("Content-Security-Policy", "script-src 'self' https://js.hsforms.net https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/; object-src 'none'; frame-ancestors 'none'; frame-src https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/")
		}

		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}

// EdgeComputeOperation defines a restricted edge compute operation.
// Use of this operation will only be authorized if edgeCompute is enabled in settings
func (bouncer *RequestBouncer) EdgeComputeOperation(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		settings, err := bouncer.dataStore.Settings().Settings()
		if err != nil {
			httperror.WriteError(w, http.StatusServiceUnavailable, "Unable to retrieve settings", err)

			return
		}

		if !settings.EnableEdgeComputeFeatures {
			httperror.WriteError(w, http.StatusServiceUnavailable, "Edge compute features are disabled", errors.New("Edge compute features are disabled"))

			return
		}

		next.ServeHTTP(w, r)
	})
}
