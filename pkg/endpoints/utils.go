package endpoints

import (
	"strings"

	portainer "github.com/portainer/portainer/api"
)

// IsLocalEndpoint returns true if this is a local environment(endpoint)
func IsLocalEndpoint(endpoint *portainer.Endpoint) bool {
	return strings.HasPrefix(endpoint.URL, "unix://") ||
		strings.HasPrefix(endpoint.URL, "npipe://") ||
		endpoint.Type == portainer.KubernetesLocalEnvironment
}

// IsKubernetesEndpoint returns true if this is a kubernetes environment(endpoint)
func IsKubernetesEndpoint(endpoint *portainer.Endpoint) bool {
	return endpoint.Type == portainer.KubernetesLocalEnvironment ||
		endpoint.Type == portainer.AgentOnKubernetesEnvironment ||
		endpoint.Type == portainer.EdgeAgentOnKubernetesEnvironment
}

// IsDockerEndpoint returns true if this is a docker environment(endpoint)
func IsDockerEndpoint(endpoint *portainer.Endpoint) bool {
	return endpoint.Type == portainer.DockerEnvironment ||
		endpoint.Type == portainer.AgentOnDockerEnvironment ||
		endpoint.Type == portainer.EdgeAgentOnDockerEnvironment
}

// IsAgentEndpoint returns true if this is an Agent endpoint
func IsAgentEndpoint(endpoint *portainer.Endpoint) bool {
	return endpoint.Type == portainer.AgentOnDockerEnvironment ||
		endpoint.Type == portainer.EdgeAgentOnDockerEnvironment ||
		endpoint.Type == portainer.AgentOnKubernetesEnvironment ||
		endpoint.Type == portainer.EdgeAgentOnKubernetesEnvironment
}

// IsEdgeEndpoint returns true if this is an Edge endpoint
func IsEdgeEndpoint(endpoint *portainer.Endpoint) bool {
	return endpoint.Type == portainer.EdgeAgentOnDockerEnvironment || endpoint.Type == portainer.EdgeAgentOnKubernetesEnvironment
}

// IsAssociatedEdgeEndpoint returns true if the environment is an Edge environment
// and has a set EdgeID and UserTrusted is true.
func IsAssociatedEdgeEndpoint(endpoint *portainer.Endpoint) bool {
	return IsEdgeEndpoint(endpoint) && endpoint.EdgeID != "" && endpoint.UserTrusted
}

// HasDirectConnectivity returns true if the environment is a non-Edge environment
// or is an associated Edge environment that is not in async mode.
func HasDirectConnectivity(endpoint *portainer.Endpoint) bool {
	return !IsEdgeEndpoint(endpoint) || (IsAssociatedEdgeEndpoint(endpoint) && !endpoint.Edge.AsyncMode)
}
