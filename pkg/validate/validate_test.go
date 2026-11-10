package validate

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func Test_IsURL(t *testing.T) {
	t.Parallel()
	testCases := []struct {
		name           string
		url            string
		expectedResult bool
	}{
		{
			name:           "simple url",
			url:            "https://google.com",
			expectedResult: true,
		},
		{
			name:           "empty",
			url:            "",
			expectedResult: false,
		},
		{
			name:           "no schema",
			url:            "google.com",
			expectedResult: true,
		},
		{
			name:           "path",
			url:            "https://google.com/some/thing",
			expectedResult: true,
		},
		{
			name:           "query params",
			url:            "https://google.com/some/thing?a=5&b=6",
			expectedResult: true,
		},
		{
			name:           "no top level domain",
			url:            "google",
			expectedResult: true,
		},
		{
			name:           "Unicode URL",
			url:            "www.xn--exampe-7db.ai",
			expectedResult: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := IsURL(tc.url)
			require.Equal(t, tc.expectedResult, result)
		})
	}
}

func Test_IsUUID(t *testing.T) {
	t.Parallel()
	testCases := []struct {
		name           string
		uuid           string
		expectedResult bool
	}{
		{
			name:           "empty",
			uuid:           "",
			expectedResult: false,
		},
		{
			name:           "version 3 UUID",
			uuid:           "060507eb-3b9a-362e-b850-d5f065eea403",
			expectedResult: true,
		},
		{
			name:           "version 4 UUID",
			uuid:           "63e695ee-48a9-498a-98b3-9472ff75e09f",
			expectedResult: true,
		},
		{
			name:           "version 5 UUID",
			uuid:           "5daabcd8-f17e-568c-aa6f-da9d92c7032c",
			expectedResult: true,
		},
		{
			name:           "text",
			uuid:           "something like this",
			expectedResult: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := IsUUID(tc.uuid)
			require.Equal(t, tc.expectedResult, result)
		})
	}
}

func Test_IsHexadecimal(t *testing.T) {
	t.Parallel()
	testCases := []struct {
		name           string
		hex            string
		expectedResult bool
	}{
		{
			name:           "empty",
			hex:            "",
			expectedResult: false,
		},
		{
			name:           "hex",
			hex:            "48656C6C6F20736F6D657468696E67",
			expectedResult: true,
		},
		{
			name:           "text",
			hex:            "something like this",
			expectedResult: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := IsHexadecimal(tc.hex)
			require.Equal(t, tc.expectedResult, result)
		})
	}
}

func Test_IsTrustedOrigin(t *testing.T) {
	t.Parallel()
	f := func(s string, expected bool) {
		t.Helper()

		result := IsTrustedOrigin(s)
		if result != expected {
			t.Fatalf("unexpected result for %q; got %t; want %t", s, result, expected)
		}
	}

	// Valid trusted origins - scheme + host
	f("http://localhost", true)
	f("https://example.com", true)
	f("http://192.168.1.1", true)
	f("https://api.example.com", true)
	f("https://subdomain.example.org", true)

	// Valid trusted origins - scheme + host + port
	f("http://localhost:8080", true)
	f("https://example.com:3000", true)
	f("http://192.168.1.1:443", true)
	f("https://api.example.com:9000", true)

	// Invalid trusted origins - bare hostname (no scheme)
	f("localhost", false)
	f("example.com", false)
	f("192.168.1.1", false)

	// Invalid trusted origins - empty or malformed
	f("", false)
	f("invalid url", false)
	f("://example.com", false)

	// Invalid trusted origins - unsupported scheme
	f("ftp://192.168.1.1", false)

	// Invalid trusted origins - with user info
	f("http://user@example.com", false)
	f("http://user:pass@localhost", false)

	// Invalid trusted origins - with path
	f("https://example.com/path", false)
	f("http://localhost/api", false)
	f("http://192.168.1.1/static", false)

	// Invalid trusted origins - with query parameters
	f("https://example.com?param=value", false)
	f("http://localhost:8080?query=test", false)

	// Invalid trusted origins - with fragment
	f("https://example.com#fragment", false)
	f("http://localhost:3000#section", false)

	// Invalid trusted origins - with multiple invalid components
	f("https://user@example.com/path?query=value#fragment", false)
	f("http://localhost:8080/api/v1?param=test", false)
}
