//go:build fuzz

// Fuzz-labeled test (COV-005, F-06): FuzzParseForwardedHeaderProto and its seed
// corpus (the `tests` table in proxy_headers_test.go) are left out of the
// reference test set. Run them with `make test-fuzz`; set FUZZTIME to fuzz.

package middlewares

import "testing"

func FuzzParseForwardedHeaderProto(f *testing.F) {
	for _, t := range tests {
		f.Add(t.forwarded)
	}

	f.Fuzz(func(t *testing.T, forwarded string) {
		parseForwardedHeaderProto(forwarded)
	})
}
