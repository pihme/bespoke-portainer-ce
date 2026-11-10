package endpointutils

import (
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/pkg/endpoints"
)

var (
	IsLocalEndpoint      = endpoints.IsLocalEndpoint
	IsKubernetesEndpoint = endpoints.IsKubernetesEndpoint
	IsDockerEndpoint     = endpoints.IsDockerEndpoint
	IsEdgeEndpoint       = endpoints.IsEdgeEndpoint
	IsAgentEndpoint      = endpoints.IsAgentEndpoint
	EndpointSet          = endpoints.EndpointSet
)

// EndpointPlatformType returns the type of the endpoint based on the environment and container engine
func EndpointPlatformType(endpoint *portainer.Endpoint) portainer.PlatformType {
	switch endpoint.Type {
	case portainer.DockerEnvironment, portainer.AgentOnDockerEnvironment, portainer.EdgeAgentOnDockerEnvironment:
		if endpoint.ContainerEngine == portainer.ContainerEnginePodman {
			return portainer.PodmanPlatformType
		}
		return portainer.DockerPlatformType
	case portainer.KubernetesLocalEnvironment, portainer.AgentOnKubernetesEnvironment, portainer.EdgeAgentOnKubernetesEnvironment:
		return portainer.KubernetesPlatformType
	case portainer.AzureEnvironment:
		return portainer.AzurePlatformType
	}
	return portainer.UnknownPlatformType
}

// FilterByExcludeIDs receives an environment(endpoint) array and returns a filtered array using an excludeIds param
func FilterByExcludeIDs(endpoints []portainer.Endpoint, excludeIds []portainer.EndpointID) []portainer.Endpoint {
	if len(excludeIds) == 0 {
		return endpoints
	}

	filteredEndpoints := make([]portainer.Endpoint, 0)

	idsSet := make(map[portainer.EndpointID]bool)
	for _, id := range excludeIds {
		idsSet[id] = true
	}

	for _, endpoint := range endpoints {
		if !idsSet[endpoint.ID] {
			filteredEndpoints = append(filteredEndpoints, endpoint)
		}
	}

	return filteredEndpoints
}

func UpdateEdgeEndpointHeartbeat(endpoint *portainer.Endpoint, settings *portainer.Settings) {
	if !IsEdgeEndpoint(endpoint) {
		return
	}

	endpoint.Heartbeat = GetHeartbeatStatus(endpoint, settings)
}

func GetHeartbeatStatus(endpoint *portainer.Endpoint, settings *portainer.Settings) bool {
	checkInInterval := getEndpointCheckinInterval(endpoint, settings)
	return time.Now().Unix()-endpoint.LastCheckInDate <= int64(checkInInterval*2+20)
}

func getEndpointCheckinInterval(endpoint *portainer.Endpoint, settings *portainer.Settings) int {
	if !endpoint.Edge.AsyncMode {
		if endpoint.EdgeCheckinInterval > 0 {
			return endpoint.EdgeCheckinInterval
		}

		return settings.EdgeAgentCheckinInterval
	}

	defaultInterval := 60
	intervals := [][]int{
		{endpoint.Edge.PingInterval, settings.Edge.PingInterval},
		{endpoint.Edge.CommandInterval, settings.Edge.CommandInterval},
		{endpoint.Edge.SnapshotInterval, settings.Edge.SnapshotInterval},
	}

	for i := range intervals {
		effectiveInterval := intervals[i][0]
		if effectiveInterval <= 0 {
			effectiveInterval = intervals[i][1]
		}

		if effectiveInterval > 0 && effectiveInterval < defaultInterval {
			defaultInterval = effectiveInterval
		}
	}

	return defaultInterval
}
