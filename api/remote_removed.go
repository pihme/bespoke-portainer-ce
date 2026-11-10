package portainer

import (
	"errors"
	"strings"
)

// ErrAgentEnvironmentNotSupported is returned for a Portainer Agent environment
// left in the database: the Agent and per-node targeting are removed (TAI-007).
var ErrAgentEnvironmentNotSupported = errors.New("Agent environments are no longer supported")

// ErrRemoteEnvironmentNotSupported is returned when a remote Docker host (Docker API
// over TCP, with or without TLS) is added or an environment is pointed at one (TAI-007).
var ErrRemoteEnvironmentNotSupported = errors.New("Remote Docker environments are no longer supported")

// IsLocalSocketURL reports whether url addresses a local Docker or Podman socket
// (unix:// or npipe://). An empty URL means the default local socket.
func IsLocalSocketURL(url string) bool {
	return url == "" || strings.HasPrefix(url, "unix://") || strings.HasPrefix(url, "npipe://")
}

// IsAgentEnvironmentType reports whether t is a (non-Edge) Portainer Agent environment type.
func IsAgentEnvironmentType(t EndpointType) bool {
	return t == AgentOnDockerEnvironment || t == AgentOnKubernetesEnvironment
}

// ErrAzureEnvironmentNotSupported is returned for Azure Container Instances
// environments, which are removed (TAI-008).
var ErrAzureEnvironmentNotSupported = errors.New("Azure environments are no longer supported")

// ErrKubernetesEnvironmentNotSupported is returned for a local Kubernetes
// environment left in the database: Kubernetes is removed (TAI-002) and the
// Kubernetes proxy is gone (TAI-016).
var ErrKubernetesEnvironmentNotSupported = errors.New("Kubernetes environments are no longer supported")
