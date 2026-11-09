package ssrf

import (
	"crypto/tls"
	"net/http"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/stretchr/testify/require"
)

func TestWrapDefaultTransportAndHTTP1Only(t *testing.T) {
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })

	svc := newStaticService(portainer.SSRFModeEnforce, []string{"example.com"})
	require.NoError(t, Configure(svc))

	require.True(t, WrapDefaultTransport())
	tr, ok := http.DefaultTransport.(*http.Transport)
	require.True(t, ok)
	require.NotNil(t, tr.DialContext)

	p := HTTP1Only()
	require.NotNil(t, p)

	withTLS := NewTransport(&tls.Config{InsecureSkipVerify: true})
	require.NotNil(t, withTLS.TLSClientConfig)
	require.True(t, withTLS.TLSClientConfig.InsecureSkipVerify)

	internal := NewInternalTransport(&tls.Config{MinVersion: tls.VersionTLS12})
	require.NotNil(t, internal.TLSClientConfig)
}

func TestWrapDefaultTransportRejectsNonTransport(t *testing.T) {
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })

	http.DefaultTransport = roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, nil
	})
	require.False(t, WrapDefaultTransport())
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
