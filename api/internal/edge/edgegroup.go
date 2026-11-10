package edge

import (
	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/internal/endpointutils"
	"github.com/portainer/portainer/api/roar"
	"github.com/portainer/portainer/api/tag"
)

// EdgeGroupRelatedEndpoints returns a list of environments(endpoints) related to this Edge group
func EdgeGroupRelatedEndpoints(edgeGroup *portainer.EdgeGroup, endpoints []portainer.Endpoint, endpointGroups []portainer.EndpointGroup) []portainer.EndpointID {
	if !edgeGroup.Dynamic {
		var r roar.Roar[portainer.EndpointID]

		for _, endpoint := range endpoints {
			if edgeGroup.EndpointIDs.Contains(endpoint.ID) {
				r.Add(endpoint.ID)
			}
		}

		return r.ToSlice()
	}

	endpointGroupsMap := map[portainer.EndpointGroupID]*portainer.EndpointGroup{}
	for i, group := range endpointGroups {
		endpointGroupsMap[group.ID] = &endpointGroups[i]
	}

	endpointIDs := []portainer.EndpointID{}
	for _, endpoint := range endpoints {
		if !endpointutils.IsEdgeEndpoint(&endpoint) {
			continue
		}

		endpointGroup := endpointGroupsMap[endpoint.GroupID]
		if edgeGroupRelatedToEndpoint(edgeGroup, &endpoint, endpointGroup) {
			endpointIDs = append(endpointIDs, endpoint.ID)
		}
	}

	return endpointIDs
}

// edgeGroupRelatedToEndpoint returns true if edgeGroup is associated with environment(endpoint)
func edgeGroupRelatedToEndpoint(edgeGroup *portainer.EdgeGroup, endpoint *portainer.Endpoint, endpointGroup *portainer.EndpointGroup) bool {
	if !edgeGroup.Dynamic {
		return edgeGroup.EndpointIDs.Contains(endpoint.ID)
	}

	endpointTags := tag.Set(endpoint.TagIDs)
	if endpointGroup != nil && endpointGroup.TagIDs != nil {
		endpointTags = tag.Union(endpointTags, tag.Set(endpointGroup.TagIDs))
	}

	if edgeGroup.PartialMatch {
		return tag.PartialMatch(edgeGroup.TagIDs, endpointTags)
	}

	return tag.FullMatch(edgeGroup.TagIDs, endpointTags)
}
