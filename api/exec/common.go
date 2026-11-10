package exec

import (
	"fmt"
	"regexp"
	"strings"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/http/proxy"
	"github.com/portainer/portainer/api/http/proxy/factory"
)

var stackNameNormalizeRegex = regexp.MustCompile("[^-_a-z0-9]+")

func normalizeStackName(name string) string {
	return stackNameNormalizeRegex.ReplaceAllString(strings.ToLower(name), "")
}

// fetchEndpointProxy returns the Docker host URL for the given endpoint.
// For remote endpoints it creates a local proxy that handles TLS termination and
// Portainer agent header injection; for local unix/npipe sockets no proxy is needed.
func fetchEndpointProxy(proxyManager *proxy.Manager, endpoint *portainer.Endpoint) (string, *factory.ProxyServer, error) {
	if strings.HasPrefix(endpoint.URL, "unix://") || strings.HasPrefix(endpoint.URL, "npipe://") {
		return "", nil, nil
	}

	proxy, err := proxyManager.CreateAgentProxyServer(endpoint)
	if err != nil {
		return "", nil, err
	}

	return fmt.Sprintf("tcp://127.0.0.1:%d", proxy.Port), proxy, nil
}
