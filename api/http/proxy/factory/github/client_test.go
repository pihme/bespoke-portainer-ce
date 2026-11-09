package github

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewClientUsesGitHubAPIHost(t *testing.T) {
	t.Parallel()

	client := NewClient("tok-123")
	require.Equal(t, GitHubAPIHost, client.baseURL)
	require.NotNil(t, client.httpClient)
	require.Equal(t, client.httpClient.Timeout.String(), "1m0s")
}

func TestNewHTTPClientSetsBearerTransport(t *testing.T) {
	t.Parallel()

	httpClient := NewHTTPClient("secret-token")
	require.NotNil(t, httpClient.Transport)
	transport, ok := httpClient.Transport.(*tokenTransport)
	require.True(t, ok)
	require.Equal(t, "secret-token", transport.token)
	require.NotNil(t, transport.transport)
}

func TestTokenTransportRoundTripAddsHeadersWhenTokenSet(t *testing.T) {
	t.Parallel()

	var sawAuth, sawAccept string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawAuth = r.Header.Get("Authorization")
		sawAccept = r.Header.Get("Accept")
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(upstream.Close)

	transport := &tokenTransport{
		token:     "abc",
		transport: http.DefaultTransport,
	}
	req, err := http.NewRequest(http.MethodGet, upstream.URL, nil)
	require.NoError(t, err)

	resp, err := transport.RoundTrip(req)
	require.NoError(t, err)
	t.Cleanup(func() { _ = resp.Body.Close() })
	require.Equal(t, http.StatusNoContent, resp.StatusCode)
	require.Equal(t, "Bearer abc", sawAuth)
	require.Equal(t, "application/vnd.github+json", sawAccept)
}

func TestTokenTransportRoundTripSkipsHeadersWithoutToken(t *testing.T) {
	t.Parallel()

	var sawAuth string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawAuth = r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "ok")
	}))
	t.Cleanup(upstream.Close)

	transport := &tokenTransport{
		token:     "",
		transport: http.DefaultTransport,
	}
	req, err := http.NewRequest(http.MethodGet, upstream.URL, nil)
	require.NoError(t, err)

	resp, err := transport.RoundTrip(req)
	require.NoError(t, err)
	t.Cleanup(func() { _ = resp.Body.Close() })
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Empty(t, sawAuth)
}

func TestGetContainerPackagesUserNamespace(t *testing.T) {
	t.Parallel()

	var sawPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawPath = r.URL.Path + "?" + r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `[{"name":"App","owner":{"login":"Alice"}},{"name":"Lib","owner":{"login":"Bob"}}]`)
	}))
	t.Cleanup(srv.Close)

	client := &Client{httpClient: srv.Client(), baseURL: srv.URL}
	repos, err := client.GetContainerPackages(context.Background(), false, "")
	require.NoError(t, err)
	require.Equal(t, "/user/packages?package_type=container", sawPath)
	require.Equal(t, []string{"alice/app", "bob/lib"}, repos)
}

func TestGetContainerPackagesOrganisationNamespace(t *testing.T) {
	t.Parallel()

	var sawPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `[{"name":"Stack","owner":{"login":"Acme"}}]`)
	}))
	t.Cleanup(srv.Close)

	client := &Client{httpClient: srv.Client(), baseURL: srv.URL}
	repos, err := client.GetContainerPackages(context.Background(), true, "AcmeOrg")
	require.NoError(t, err)
	require.Equal(t, "/orgs/AcmeOrg/packages", sawPath)
	require.Equal(t, []string{"acme/stack"}, repos)
}

func TestGetContainerPackagesNonOKStatus(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusForbidden)
	}))
	t.Cleanup(srv.Close)

	client := &Client{httpClient: srv.Client(), baseURL: srv.URL}
	_, err := client.GetContainerPackages(context.Background(), false, "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "GitHub API returned status 403")
}

func TestGetContainerPackagesInvalidJSON(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "not-json")
	}))
	t.Cleanup(srv.Close)

	client := &Client{httpClient: srv.Client(), baseURL: srv.URL}
	_, err := client.GetContainerPackages(context.Background(), false, "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "failed to parse response")
}

func TestGetContainerPackagesRequestError(t *testing.T) {
	t.Parallel()

	client := &Client{
		httpClient: &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
			return nil, context.Canceled
		})},
		baseURL: "http://example.test",
	}
	_, err := client.GetContainerPackages(context.Background(), false, "")
	require.Error(t, err)
	require.Contains(t, err.Error(), "failed to execute request")
}

func TestGetContainerPackagesInvalidURL(t *testing.T) {
	t.Parallel()

	client := &Client{httpClient: http.DefaultClient, baseURL: "http://[::1"}
	_, err := client.GetContainerPackages(context.Background(), false, "")
	require.Error(t, err)
	require.True(t, strings.Contains(err.Error(), "failed to create request") || err != nil)
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
