package client

import (
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/pkg/fips"

	"github.com/stretchr/testify/require"
)

func TestNewHTTPClient(t *testing.T) {
	t.Parallel()
	c := NewHTTPClient()
	require.NotNil(t, c)
	require.NotNil(t, c.Client)
	require.Equal(t, defaultHTTPTimeout, int(c.Timeout.Seconds()))
}

func TestGet_SuccessAndErrors(t *testing.T) {
	t.Parallel()

	okSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("payload"))
	}))
	t.Cleanup(okSrv.Close)

	body, err := Get(okSrv.URL, 0) // default timeout
	require.NoError(t, err)
	require.Equal(t, []byte("payload"), body)

	body, err = Get(okSrv.URL, 2)
	require.NoError(t, err)
	require.Equal(t, []byte("payload"), body)

	badSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(badSrv.Close)
	_, err = Get(badSrv.URL, 1)
	require.ErrorIs(t, err, errInvalidResponseStatus)

	_, err = Get("http://127.0.0.1:1", 1)
	require.Error(t, err)
}

func TestExecutePingOperation_LocalHTTP(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/_ping", r.URL.Path)
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(srv.Close)

	agent, err := ExecutePingOperation(srv.URL, portainer.TLSConfiguration{})
	require.NoError(t, err)
	require.False(t, agent)

	agentSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(portainer.PortainerAgentHeader, "yes")
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(agentSrv.Close)
	agent, err = ExecutePingOperation("tcp://"+agentSrv.Listener.Addr().String(), portainer.TLSConfiguration{})
	require.NoError(t, err)
	require.True(t, agent)
}

func TestPingOperation_NoAgentHeader(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(srv.Close)
	agent, err := pingOperation(http.DefaultClient, srv.URL)
	require.NoError(t, err)
	require.False(t, agent)
}
