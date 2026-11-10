package endpoints

import (
	"net/http"
	"slices"
	"strings"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/endpointutils"
	"github.com/portainer/portainer/api/roar"
	"github.com/portainer/portainer/api/set"
	"github.com/portainer/portainer/api/slicesx"
	"github.com/portainer/portainer/pkg/libhttp/request"
)

type EnvironmentsQuery struct {
	search           string
	groupIds         []portainer.EndpointGroupID
	status           []portainer.EndpointStatus
	types            []portainer.EndpointType
	platformTypes    []portainer.PlatformType
	outdated         bool
	excludeGroupIds  []portainer.EndpointGroupID
	tagIds           []portainer.TagID
	tagsPartialMatch bool
	endpointIds      []portainer.EndpointID
	excludeIds       []portainer.EndpointID
	// if edgeAsync not nil, will filter edge endpoints based on this value
	edgeAsync                *bool
	edgeDeviceUntrusted      bool
	edgeCheckInPassedSeconds int
	excludeSnapshots         bool
	name                     string
}

func parseQuery(r *http.Request) (EnvironmentsQuery, error) {
	search, _ := request.RetrieveQueryParameter(r, "search", true)
	if search != "" {
		search = strings.ToLower(search)
	}

	status, err := request.RetrieveNumberArrayQueryParameter[portainer.EndpointStatus](r, "status")
	if err != nil {
		return EnvironmentsQuery{}, err
	}

	groupIDs, err := request.RetrieveNumberArrayQueryParameter[portainer.EndpointGroupID](r, "groupIds")
	if err != nil {
		return EnvironmentsQuery{}, err
	}

	endpointTypes, err := request.RetrieveNumberArrayQueryParameter[portainer.EndpointType](r, "types")
	if err != nil {
		return EnvironmentsQuery{}, err
	}

	platformTypes, err := request.RetrieveNumberArrayQueryParameter[portainer.PlatformType](r, "platformTypes")
	if err != nil {
		return EnvironmentsQuery{}, err
	}

	tagIDs, err := request.RetrieveNumberArrayQueryParameter[portainer.TagID](r, "tagIds")
	if err != nil {
		return EnvironmentsQuery{}, err
	}

	tagsPartialMatch, _ := request.RetrieveBooleanQueryParameter(r, "tagsPartialMatch", true)

	endpointIDs, err := request.RetrieveNumberArrayQueryParameter[portainer.EndpointID](r, "endpointIds")
	if err != nil {
		return EnvironmentsQuery{}, err
	}

	excludeIDs, err := request.RetrieveNumberArrayQueryParameter[portainer.EndpointID](r, "excludeIds")
	if err != nil {
		return EnvironmentsQuery{}, err
	}

	excludeGroupIDs, err := request.RetrieveNumberArrayQueryParameter[portainer.EndpointGroupID](r, "excludeGroupIds")
	if err != nil {
		return EnvironmentsQuery{}, err
	}

	outdated, _ := request.RetrieveBooleanQueryParameter(r, "outdated", true)

	name, _ := request.RetrieveQueryParameter(r, "name", true)

	var edgeAsync *bool
	edgeAsyncParam, _ := request.RetrieveQueryParameter(r, "edgeAsync", true)
	if edgeAsyncParam != "" {
		edgeAsync = new(edgeAsyncParam == "true")
	}

	edgeDeviceUntrusted, _ := request.RetrieveBooleanQueryParameter(r, "edgeDeviceUntrusted", true)

	excludeSnapshots, _ := request.RetrieveBooleanQueryParameter(r, "excludeSnapshots", true)

	edgeCheckInPassedSeconds, _ := request.RetrieveNumericQueryParameter(r, "edgeCheckInPassedSeconds", true)

	return EnvironmentsQuery{
		search:                   search,
		types:                    endpointTypes,
		platformTypes:            platformTypes,
		tagIds:                   tagIDs,
		endpointIds:              endpointIDs,
		excludeIds:               excludeIDs,
		excludeGroupIds:          excludeGroupIDs,
		tagsPartialMatch:         tagsPartialMatch,
		groupIds:                 groupIDs,
		status:                   status,
		edgeAsync:                edgeAsync,
		edgeDeviceUntrusted:      edgeDeviceUntrusted,
		excludeSnapshots:         excludeSnapshots,
		name:                     name,
		outdated:                 outdated,
		edgeCheckInPassedSeconds: edgeCheckInPassedSeconds,
	}, nil
}

func (handler *Handler) filterEndpointsByQuery(
	filteredEndpoints []portainer.Endpoint,
	query EnvironmentsQuery,
	groups []portainer.EndpointGroup,
	settings *portainer.Settings,
	context *security.RestrictedRequestContext,
) ([]portainer.Endpoint, int, error) {
	totalAvailableEndpoints := len(filteredEndpoints)

	if len(query.endpointIds) > 0 {
		endpointIDs := roar.FromSlice(query.endpointIds)

		filteredEndpoints = filteredEndpointsByIds(filteredEndpoints, endpointIDs)
	}

	if len(query.excludeIds) > 0 {
		filteredEndpoints = filter(filteredEndpoints, func(endpoint portainer.Endpoint) bool {
			return !slices.Contains(query.excludeIds, endpoint.ID)
		})
	}

	if len(query.excludeGroupIds) > 0 {
		filteredEndpoints = filter(filteredEndpoints, func(endpoint portainer.Endpoint) bool {
			return !slices.Contains(query.excludeGroupIds, endpoint.GroupID)
		})
	}

	if len(query.groupIds) > 0 {
		filteredEndpoints = filterEndpointsByGroupIDs(filteredEndpoints, query.groupIds)
	}

	if query.name != "" {
		filteredEndpoints = filterEndpointsByName(filteredEndpoints, query.name)
	}

	// filter async edge environments
	if query.edgeAsync != nil {
		filteredEndpoints = filter(filteredEndpoints, func(endpoint portainer.Endpoint) bool {
			if !endpointutils.IsEdgeEndpoint(&endpoint) {
				return true
			}

			return endpoint.Edge.AsyncMode == *query.edgeAsync
		})
	}

	// filter edge environments by trusted/untrusted
	// only portainer admins are allowed to see untrusted environments
	filteredEndpoints = filter(filteredEndpoints, func(endpoint portainer.Endpoint) bool {
		if !endpointutils.IsEdgeEndpoint(&endpoint) {
			return true
		}

		if query.edgeDeviceUntrusted {
			return !endpoint.UserTrusted && context.IsAdmin
		}

		return endpoint.UserTrusted == !query.edgeDeviceUntrusted
	})

	if query.edgeCheckInPassedSeconds > 0 {
		filteredEndpoints = filter(filteredEndpoints, func(endpoint portainer.Endpoint) bool {
			// ignore non-edge endpoints
			if !endpointutils.IsEdgeEndpoint(&endpoint) {
				return true
			}

			// filter out endpoints that have never checked in
			if endpoint.LastCheckInDate == 0 {
				return false
			}

			return time.Now().Unix()-endpoint.LastCheckInDate < int64(query.edgeCheckInPassedSeconds)
		})
	}

	if len(query.status) > 0 {
		filteredEndpoints = filterEndpointsByStatuses(filteredEndpoints, query.status, settings)
	}

	if query.search != "" {
		filteredEndpoints = filterEndpointsBySearchCriteria(filteredEndpoints, groups, query.search)
	}

	if len(query.types) > 0 {
		filteredEndpoints = filterEndpointsByTypes(filteredEndpoints, query.types)
	}

	if len(query.platformTypes) > 0 {
		filteredEndpoints = filterEndpointsByPlatform(filteredEndpoints, query.platformTypes)
	}

	if len(query.tagIds) > 0 {
		filteredEndpoints = filteredEndpointsByTags(filteredEndpoints, query.tagIds, groups, query.tagsPartialMatch)
	}

	if query.outdated {
		filteredEndpoints = filter(filteredEndpoints, func(endpoint portainer.Endpoint) bool {
			return isOutdated(&endpoint)
		})
	}

	return filteredEndpoints, totalAvailableEndpoints, nil
}

func filterEndpointsByGroupIDs(endpoints []portainer.Endpoint, endpointGroupIDs []portainer.EndpointGroupID) []portainer.Endpoint {
	n := 0
	for _, endpoint := range endpoints {
		if slices.Contains(endpointGroupIDs, endpoint.GroupID) {
			endpoints[n] = endpoint
			n++
		}
	}

	return endpoints[:n]
}

func filterEndpointsBySearchCriteria(
	endpoints []portainer.Endpoint,
	endpointGroups []portainer.EndpointGroup,
	searchCriteria string,
) []portainer.Endpoint {
	n := 0
	for _, endpoint := range endpoints {
		if endpointMatchSearchCriteria(&endpoint, searchCriteria) {
			endpoints[n] = endpoint
			n++

			continue
		}

		if endpointGroupMatchSearchCriteria(&endpoint, endpointGroups, searchCriteria) {
			endpoints[n] = endpoint
			n++

			continue
		}

	}

	return endpoints[:n]
}

func filterEndpointsByStatuses(endpoints []portainer.Endpoint, statuses []portainer.EndpointStatus, settings *portainer.Settings) []portainer.Endpoint {
	n := 0
	for _, endpoint := range endpoints {
		status := endpoint.Status
		if endpointutils.IsEdgeEndpoint(&endpoint) {
			isCheckValid := false

			edgeCheckinInterval := endpoint.EdgeCheckinInterval
			if edgeCheckinInterval == 0 {
				edgeCheckinInterval = settings.EdgeAgentCheckinInterval
			}

			if endpoint.Edge.AsyncMode {
				edgeCheckinInterval = getShortestAsyncInterval(&endpoint, settings)
			}

			if edgeCheckinInterval != 0 && endpoint.LastCheckInDate != 0 {
				isCheckValid = time.Now().Unix()-endpoint.LastCheckInDate <= int64(edgeCheckinInterval*EdgeDeviceIntervalMultiplier+EdgeDeviceIntervalAdd)
			}

			status = portainer.EndpointStatusDown // Offline
			if isCheckValid {
				status = portainer.EndpointStatusUp // Online
			}
		}

		if slices.Contains(statuses, status) {
			endpoints[n] = endpoint
			n++
		}
	}

	return endpoints[:n]
}

func endpointMatchSearchCriteria(endpoint *portainer.Endpoint, searchCriteria string) bool {
	if strings.Contains(strings.ToLower(endpoint.Name), searchCriteria) {
		return true
	}

	if strings.Contains(strings.ToLower(endpoint.URL), searchCriteria) {
		return true
	}

	if endpoint.Status == portainer.EndpointStatusUp && searchCriteria == "up" {
		return true
	} else if endpoint.Status == portainer.EndpointStatusDown && searchCriteria == "down" {
		return true
	}

	return false
}

func endpointGroupMatchSearchCriteria(endpoint *portainer.Endpoint, endpointGroups []portainer.EndpointGroup, searchCriteria string) bool {
	for _, group := range endpointGroups {
		if group.ID != endpoint.GroupID {
			continue
		}

		if strings.Contains(strings.ToLower(group.Name), searchCriteria) {
			return true
		}
	}

	return false
}

func filterEndpointsByTypes(endpoints []portainer.Endpoint, endpointTypes []portainer.EndpointType) []portainer.Endpoint {
	typeSet := set.ToSet(endpointTypes)

	return slicesx.Filter(endpoints, func(e portainer.Endpoint) bool {
		return typeSet[e.Type]
	})
}

func filterEndpointsByPlatform(endpoints []portainer.Endpoint, platformTypes []portainer.PlatformType) []portainer.Endpoint {
	typeSet := set.ToSet(platformTypes)

	return slicesx.Filter(endpoints, func(e portainer.Endpoint) bool {
		return typeSet[endpointutils.EndpointPlatformType(&e)]
	})
}

func filteredEndpointsByTags(endpoints []portainer.Endpoint, tagIDs []portainer.TagID, endpointGroups []portainer.EndpointGroup, partialMatch bool) []portainer.Endpoint {
	n := 0
	for _, endpoint := range endpoints {
		endpointGroup := getEndpointGroup(endpoint.GroupID, endpointGroups)
		endpointMatched := false

		if partialMatch {
			endpointMatched = endpointPartialMatchTags(endpoint, endpointGroup, tagIDs)
		} else {
			endpointMatched = endpointFullMatchTags(endpoint, endpointGroup, tagIDs)
		}

		if endpointMatched {
			endpoints[n] = endpoint
			n++
		}
	}

	return endpoints[:n]
}

func endpointPartialMatchTags(endpoint portainer.Endpoint, endpointGroup portainer.EndpointGroup, tagIDs []portainer.TagID) bool {
	tagSet := make(map[portainer.TagID]bool, len(tagIDs))

	for _, tagID := range tagIDs {
		tagSet[tagID] = true
	}

	for _, tagID := range endpoint.TagIDs {
		if tagSet[tagID] {
			return true
		}
	}

	for _, tagID := range endpointGroup.TagIDs {
		if tagSet[tagID] {
			return true
		}
	}

	return false
}

func endpointFullMatchTags(endpoint portainer.Endpoint, endpointGroup portainer.EndpointGroup, tagIDs []portainer.TagID) bool {
	missingTags := make(map[portainer.TagID]bool)
	for _, tagID := range tagIDs {
		missingTags[tagID] = true
	}

	for _, tagID := range endpoint.TagIDs {
		if missingTags[tagID] {
			delete(missingTags, tagID)
		}
	}

	for _, tagID := range endpointGroup.TagIDs {
		if missingTags[tagID] {
			delete(missingTags, tagID)
		}
	}

	return len(missingTags) == 0
}

func filteredEndpointsByIds(endpoints []portainer.Endpoint, ids roar.Roar[portainer.EndpointID]) []portainer.Endpoint {
	n := 0
	for _, endpoint := range endpoints {
		if ids.Contains(endpoint.ID) {
			endpoints[n] = endpoint
			n++
		}
	}

	return endpoints[:n]
}

func filterEndpointsByName(endpoints []portainer.Endpoint, name string) []portainer.Endpoint {
	if name == "" {
		return endpoints
	}

	n := 0
	for _, endpoint := range endpoints {
		if endpoint.Name == name {
			endpoints[n] = endpoint
			n++
		}
	}

	return endpoints[:n]
}

func filter(endpoints []portainer.Endpoint, predicate func(endpoint portainer.Endpoint) bool) []portainer.Endpoint {
	n := 0
	for _, endpoint := range endpoints {
		if predicate(endpoint) {
			endpoints[n] = endpoint
			n++
		}
	}

	return endpoints[:n]
}

func getShortestAsyncInterval(endpoint *portainer.Endpoint, settings *portainer.Settings) int {
	const edgeIntervalUseDefault = -1

	pingInterval := endpoint.Edge.PingInterval
	if pingInterval == edgeIntervalUseDefault {
		pingInterval = settings.Edge.PingInterval
	}

	snapshotInterval := endpoint.Edge.SnapshotInterval
	if snapshotInterval == edgeIntervalUseDefault {
		snapshotInterval = settings.Edge.SnapshotInterval
	}

	commandInterval := endpoint.Edge.CommandInterval
	if commandInterval == edgeIntervalUseDefault {
		commandInterval = settings.Edge.CommandInterval
	}

	return min(pingInterval, snapshotInterval, commandInterval)
}
