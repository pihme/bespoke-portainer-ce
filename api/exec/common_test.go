package exec

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/http/proxy"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_normalizeStackName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		in, want string
	}{
		{"Simple", "simple"},
		{"My Stack!", "mystack"},
		{"a_b-c", "a_b-c"},
		{"UPPER case", "uppercase"},
		{"@@@", ""},
		{"", ""},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tt.want, normalizeStackName(tt.in))
		})
	}
}

func Test_fetchEndpointProxy_LocalSockets(t *testing.T) {
	t.Parallel()

	for _, url := range []string{"unix:///var/run/docker.sock", "npipe://./pipe/docker_engine"} {
		t.Run(url, func(t *testing.T) {
			t.Parallel()
			host, proxyServer, err := fetchEndpointProxy(nil, &portainer.Endpoint{URL: url})
			require.NoError(t, err)
			assert.Empty(t, host)
			assert.Nil(t, proxyServer)
		})
	}
}

func Test_fetchEndpointProxy_RemoteWithoutFactory(t *testing.T) {
	t.Parallel()

	host, proxyServer, err := fetchEndpointProxy(&proxy.Manager{}, &portainer.Endpoint{URL: "tcp://10.0.0.1:9001"})
	require.Error(t, err)
	assert.Empty(t, host)
	assert.Nil(t, proxyServer)
	assert.ErrorIs(t, err, proxy.ErrProxyFactoryNotInitialized)
}
