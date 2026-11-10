package client

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/crypto"
	"github.com/portainer/portainer/pkg/libhttp/ssrf"

	"github.com/rs/zerolog/log"
)

var errInvalidResponseStatus = errors.New("invalid response status (expecting 200)")

const defaultHTTPTimeout = 5

// Get executes a simple HTTP GET to the specified URL and returns
// the content of the response body. Timeout can be specified via the timeout parameter,
// will default to defaultHTTPTimeout if set to 0.
func Get(url string, timeout int) ([]byte, error) {
	if timeout == 0 {
		timeout = defaultHTTPTimeout
	}

	client := &http.Client{
		Timeout: time.Second * time.Duration(timeout),
	}

	response, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := response.Body.Close(); err != nil {
			log.Warn().Err(err).Msg("failed to close response body")
		}
	}()

	if response.StatusCode != http.StatusOK {
		log.Error().Int("status_code", response.StatusCode).Msg("unexpected status code")

		return nil, errInvalidResponseStatus
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	return body, nil
}

// ExecutePingOperation will send a SystemPing operation HTTP request to a Docker environment(endpoint)
// using the specified host and optional TLS configuration.
// It uses a new Http.Client for each operation.
func ExecutePingOperation(host string, tlsConfiguration portainer.TLSConfiguration) (bool, error) {
	scheme := "http"

	var transport *http.Transport
	if tlsConfiguration.TLS {
		tlsConfig, err := crypto.CreateTLSConfigurationFromDisk(tlsConfiguration)
		if err != nil {
			return false, err
		}

		scheme = "https"
		transport = ssrf.NewTransport(tlsConfig)
	} else {
		transport = ssrf.NewTransport(nil)
	}

	client := &http.Client{
		Timeout:   3 * time.Second,
		Transport: transport,
	}

	target := strings.Replace(host, "tcp://", scheme+"://", 1)

	return pingOperation(client, target)
}

func pingOperation(client *http.Client, target string) (bool, error) {
	pingOperationURL := target + "/_ping"

	resp, err := client.Get(pingOperationURL)
	if err != nil {
		return false, err
	}

	_, _ = io.Copy(io.Discard, resp.Body)

	if err := resp.Body.Close(); err != nil {
		log.Warn().Err(err).Msg("failed to close response body")
	}

	agentOnDockerEnvironment := resp.Header.Get(portainer.PortainerAgentHeader) != ""

	return agentOnDockerEnvironment, nil
}
