package security

import (
	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/slicesx"
)

// FilterEndpoints filters environments(endpoints) based on user role and team memberships.
// Non administrator only have access to authorized environments(endpoints) (can be inherited via endpoint groups).
func FilterEndpoints(endpoints []portainer.Endpoint, groups []portainer.EndpointGroup, context *RestrictedRequestContext) []portainer.Endpoint {
	if context.IsAdmin {
		return endpoints
	}

	n := 0
	for _, endpoint := range endpoints {
		endpointGroup := getAssociatedGroup(&endpoint, groups)
		if endpointGroup == nil {
			continue
		}

		if AuthorizedEndpointAccess(&endpoint, endpointGroup, context.UserID, context.UserMemberships) {
			endpoint.UserAccessPolicies = nil
			endpoints[n] = endpoint
			n++
		}
	}

	return endpoints[:n]
}

// FilterEndpointGroups filters environment(endpoint) groups based on user role and team memberships.
// Non administrator users only have access to authorized environment(endpoint) groups.
func FilterEndpointGroups(endpointGroups []portainer.EndpointGroup, context *RestrictedRequestContext) []portainer.EndpointGroup {
	if context.IsAdmin {
		return endpointGroups
	}

	return slicesx.FilterInPlace(endpointGroups, func(group portainer.EndpointGroup) bool {
		return authorizedEndpointGroupAccess(&group, context.UserID, context.UserMemberships)
	})
}

func getAssociatedGroup(endpoint *portainer.Endpoint, groups []portainer.EndpointGroup) *portainer.EndpointGroup {
	for _, group := range groups {
		if group.ID == endpoint.GroupID {
			return &group
		}
	}

	return nil
}
