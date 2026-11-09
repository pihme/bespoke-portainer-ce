package networking

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/portainer/portainer/pkg/fips"
	"github.com/stretchr/testify/require"
)

func TestParseURLDefaultsAndInvalid(t *testing.T) {
	t.Parallel()

	network, host, port := parseURL("http://example.test")
	require.Equal(t, "http", network)
	require.Equal(t, "example.test", host)
	require.Equal(t, "80", port)

	network, host, port = parseURL("https://secure.test")
	require.Equal(t, "https", network)
	require.Equal(t, "secure.test", host)
	require.Equal(t, "443", port)

	network, host, port = parseURL("tcp://127.0.0.1:2375")
	require.Equal(t, "tcp", network)
	require.Equal(t, "127.0.0.1", host)
	require.Equal(t, "2375", port)

	network, host, port = parseURL("http://%zz")
	require.Empty(t, network)
	require.Empty(t, host)
	require.Empty(t, port)
}

func TestProbeDNSConnectionLocalLookup(t *testing.T) {
	t.Parallel()

	okResp := ProbeDNSConnection("http://localhost")
	var okResult dnsResponse
	require.NoError(t, json.Unmarshal([]byte(okResp), &okResult))
	require.Equal(t, "dns lookup", okResult.Operation)
	require.Equal(t, "localhost", okResult.RemoteAddr)
	require.Contains(t, okResult.Status, "dns lookup successful")
	require.NotEmpty(t, okResult.ResolvedIPs)

	// parseURL rejects invalid escapes, so LookupIP("") fails even when the
	// sandbox DNS synthesizes answers for *.invalid names.
	failResp := ProbeDNSConnection("http://%zz")
	var failResult dnsResponse
	require.NoError(t, json.Unmarshal([]byte(failResp), &failResult))
	require.Contains(t, failResult.Status, "dns lookup failed")
}

func TestProbeTelnetConnectionHTTPSchemeUsesTCP(t *testing.T) {
	t.Parallel()

	ln := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(ln.Close)

	resp := ProbeTelnetConnection(ln.URL)
	var result telnetResponse
	require.NoError(t, json.Unmarshal([]byte(resp), &result))
	require.Equal(t, "tcp", result.Network)
	require.Contains(t, result.Status, "connected to")
	require.NotEqual(t, "unknown", result.LocalAddr)
	require.NotEqual(t, "unknown", result.RemoteAddr)
}

func TestDetectProxyViaHeadersAndNoProxy(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)

	proxySrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Via", "1.1 proxy.example")
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(proxySrv.Close)

	resp := DetectProxy(proxySrv.URL)
	var proxied proxyResponse
	require.NoError(t, json.Unmarshal([]byte(resp), &proxied))
	require.Equal(t, "proxy detection", proxied.Operation)
	require.Equal(t, "proxy detected via headers", proxied.Status)
	require.NotEqual(t, "unknown", proxied.LocalAddr)

	cleanSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(cleanSrv.Close)

	resp = DetectProxy(cleanSrv.URL)
	var clean proxyResponse
	require.NoError(t, json.Unmarshal([]byte(resp), &clean))
	require.Equal(t, "no proxy detected", clean.Status)
}

func TestDetectProxyViaCertificateCommonName(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)

	// Build a self-signed CA certificate whose Issuer/Subject CN contains "proxy"
	// so DetectProxy's certificate heuristic fires after a successful HTTPS GET.
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	tmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "local-proxy-ca"},
		Issuer:                pkix.Name{CommonName: "local-proxy-ca"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		IsCA:                  true,
		DNSNames:              []string{"127.0.0.1", "localhost"},
		IPAddresses:           []net.IP{net.ParseIP("127.0.0.1")},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	require.NoError(t, err)
	cert, err := x509.ParseCertificate(der)
	require.NoError(t, err)

	tlsCert := tls.Certificate{
		Certificate: [][]byte{der},
		PrivateKey:  key,
		Leaf:        cert,
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	srv := &http.Server{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
		TLSConfig: &tls.Config{Certificates: []tls.Certificate{tlsCert}, MinVersion: tls.VersionTLS12},
	}
	go srv.ServeTLS(ln, "", "")
	t.Cleanup(func() { _ = srv.Close() })

	url := "https://" + ln.Addr().String()
	resp := DetectProxy(url)
	var result proxyResponse
	require.NoError(t, json.Unmarshal([]byte(resp), &result))
	require.Equal(t, "proxy detected via certificate", result.Status)
}
