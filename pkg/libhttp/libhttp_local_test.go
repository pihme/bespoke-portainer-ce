package libhttp

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestClientIP_UnparseableRemoteAddr(t *testing.T) {
	t.Parallel()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "not-an-address"
	require.Equal(t, "not-an-address", ClientIP(req, nil))
}

func TestParseForwardedIP_EmptyAndInvalid(t *testing.T) {
	t.Parallel()
	_, ok := parseForwardedIP("   ")
	require.False(t, ok)
	_, ok = parseForwardedIP("not-an-ip")
	require.False(t, ok)
	_, ok = parseForwardedIP("host.example:badport")
	require.False(t, ok)

	got, ok := parseForwardedIP("127.0.0.1:8080")
	require.True(t, ok)
	require.Equal(t, "127.0.0.1", got)
}

func TestLastForwardedHeaderFor_MissingForParam(t *testing.T) {
	t.Parallel()
	_, ok := lastForwardedHeaderFor(`host=example.com`)
	require.False(t, ok)
	_, ok = lastForwardedHeaderFor("")
	require.False(t, ok)
}

func TestForwardedElementParam_SkipsPairsWithoutEquals(t *testing.T) {
	t.Parallel()
	got, ok := ForwardedElementParam("bare;for=1.2.3.4", "for")
	require.True(t, ok)
	require.Equal(t, "1.2.3.4", got)
	_, ok = ForwardedElementParam("bare;also-bare", "for")
	require.False(t, ok)
}

func TestIsLocalRequest_RejectsUnparseableRemote(t *testing.T) {
	t.Parallel()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "bad"
	require.False(t, IsLocalRequest(req))
}

func TestIsLocalRequest_RejectsMissingOrBadLocalAddr(t *testing.T) {
	t.Parallel()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "10.0.0.1:1234"
	require.False(t, IsLocalRequest(req))

	req = req.WithContext(context.WithValue(req.Context(), http.LocalAddrContextKey, "not-an-addr"))
	require.False(t, IsLocalRequest(req))

	req = httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = "10.0.0.1:1234"
	req = req.WithContext(context.WithValue(req.Context(), http.LocalAddrContextKey, &net.TCPAddr{IP: nil, Port: 80}))
	// TCPAddr.String() for nil IP is ":80", which ParseRequestIP rejects.
	require.False(t, IsLocalRequest(req))
}

func TestParseRequestIP_Invalid(t *testing.T) {
	t.Parallel()
	require.Nil(t, ParseRequestIP("no-port"))
	require.Nil(t, ParseRequestIP(""))
}
