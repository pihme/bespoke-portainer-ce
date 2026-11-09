package cli

import (
	"io"
	"os"
	"strings"
	"testing"

	portainer "github.com/portainer/portainer/api"

	"github.com/alecthomas/kingpin/v2"
	zerolog "github.com/rs/zerolog/log"
	"github.com/stretchr/testify/require"
)

func TestOptionParser(t *testing.T) {
	p := Service{}
	require.NotNil(t, p)

	a := os.Args
	defer func() { os.Args = a }()

	os.Args = []string{"portainer", "--edge-compute"}

	opts, err := p.ParseFlags("2.34.5")
	require.NoError(t, err)

	require.False(t, *opts.HTTPDisabled)
	require.True(t, *opts.EnableEdgeComputeFeatures)
}

// TAI-001: the first-administrator and setup-token flags are gone, so the
// parser rejects them as unknown flags.
func TestREQ_TAI_001_LoginSetupFlagsAreRejected(t *testing.T) {
	setOsArgs(t, []string{"portainer"})

	_, err := Service{}.ParseFlags("test-version")
	require.NoError(t, err)

	for _, name := range []string{"admin-password", "admin-password-file", "setup-token", "no-setup-token"} {
		require.Nil(t, kingpin.CommandLine.GetFlag(name), name)

		_, err := kingpin.CommandLine.Parse([]string{"--" + name})
		require.ErrorContains(t, err, "unknown long flag '--"+name+"'")
	}
}

func TestParseEdgeFlags(t *testing.T) {
	const edgeURL = "https://edge.example.com:9443"

	testCases := []struct {
		name          string
		args          []string
		envVars       map[string]string
		expectedURL   string
		expectedTrust bool
	}{
		{
			name:          "no edge flags or env vars",
			expectedURL:   "",
			expectedTrust: false,
		},
		{
			name:          "flags set",
			args:          []string{"portainer", "--edge-portainer-url", edgeURL, "--edge-trust-on-first-connect"},
			expectedURL:   edgeURL,
			expectedTrust: true,
		},
		{
			name: "env vars set",
			envVars: map[string]string{
				portainer.EdgePortainerURLEnvVar:        edgeURL,
				portainer.EdgeTrustOnFirstConnectEnvVar: "1",
			},
			expectedURL:   edgeURL,
			expectedTrust: true,
		},
		{
			name:        "flag overrides env var",
			args:        []string{"portainer", "--edge-portainer-url", edgeURL},
			envVars:     map[string]string{portainer.EdgePortainerURLEnvVar: "https://other.example.com:9443"},
			expectedURL: edgeURL,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.args == nil {
				tc.args = []string{"portainer"}
			}
			setOsArgs(t, tc.args)

			for k, v := range tc.envVars {
				t.Setenv(k, v)
			}

			flags, err := Service{}.ParseFlags("test-version")
			require.NoError(t, err)

			require.Equal(t, tc.expectedURL, *flags.EdgePortainerURL)
			require.Equal(t, tc.expectedTrust, *flags.EdgeTrustOnFirstConnect)
		})
	}
}

func TestValidateEdgePortainerURL(t *testing.T) {
	testCases := []struct {
		name      string
		edgeURL   string
		expectErr bool
	}{
		{name: "empty url is valid (flags are optional)", edgeURL: ""},
		{name: "valid https url with port", edgeURL: "https://edge.example.com:9443"},
		{name: "localhost is rejected", edgeURL: "https://localhost:9443", expectErr: true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateEdgePortainerURL(tc.edgeURL)
			if tc.expectErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestParseKubectlShellImageFlag(t *testing.T) {
	tests := []struct {
		name                         string
		args                         []string
		envVars                      map[string]string
		expectedKubectlShellImageSet bool
		expectedKubectlShellFlag     string
	}{
		{
			name:                         "no flag, no env var",
			expectedKubectlShellImageSet: false,
			expectedKubectlShellFlag:     portainer.DefaultKubectlShellImage,
		},
		{
			name:                         "explicit flag",
			args:                         []string{"portainer", "--kubectl-shell-image=myimage:v2"},
			expectedKubectlShellImageSet: true,
			expectedKubectlShellFlag:     "myimage:v2",
		},
		{
			name:                         "env var",
			envVars:                      map[string]string{portainer.KubectlShellImageEnvVar: "myimage:v3"},
			expectedKubectlShellImageSet: true,
			expectedKubectlShellFlag:     "myimage:v3",
		},
		{
			name:                         "both env var and flag set",
			args:                         []string{"portainer", "--kubectl-shell-image=myimage:v2"},
			envVars:                      map[string]string{portainer.KubectlShellImageEnvVar: "myimage:v3"},
			expectedKubectlShellImageSet: true,
			expectedKubectlShellFlag:     "myimage:v2",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if tc.args == nil {
				tc.args = []string{"portainer"}
			}
			setOsArgs(t, tc.args)

			for k, v := range tc.envVars {
				t.Setenv(k, v)
			}

			flags, err := Service{}.ParseFlags("test-version")
			require.NoError(t, err)
			require.Equal(t, tc.expectedKubectlShellImageSet, flags.KubectlShellImageSet)
			require.Equal(t, tc.expectedKubectlShellFlag, *flags.KubectlShellImage)
		})
	}
}

func TestParseTLSFlags(t *testing.T) {
	testCases := []struct {
		name                string
		args                []string
		expectedTLSFlag     bool
		expectedTLSCertFlag string
		expectedTLSKeyFlag  string
		expectedLogMessages []string
	}{
		{
			name:                "no flags",
			expectedTLSFlag:     false,
			expectedTLSCertFlag: "",
			expectedTLSKeyFlag:  "",
		},
		{
			name: "only ssl flag",
			args: []string{
				"portainer",
				"--ssl",
			},
			expectedTLSFlag:     true,
			expectedTLSCertFlag: "",
			expectedTLSKeyFlag:  "",
		},
		{
			name: "only tls flag",
			args: []string{
				"portainer",
				"--tlsverify",
			},
			expectedTLSFlag:     true,
			expectedTLSCertFlag: defaultTLSCertPath,
			expectedTLSKeyFlag:  defaultTLSKeyPath,
		},
		{
			name: "partial ssl flags",
			args: []string{
				"portainer",
				"--ssl",
				"--sslcert=ssl-cert-flag-value",
			},
			expectedTLSFlag:     true,
			expectedTLSCertFlag: "ssl-cert-flag-value",
			expectedTLSKeyFlag:  "",
		},
		{
			name: "partial tls flags",
			args: []string{
				"portainer",
				"--tlsverify",
				"--tlscert=tls-cert-flag-value",
			},
			expectedTLSFlag:     true,
			expectedTLSCertFlag: "tls-cert-flag-value",
			expectedTLSKeyFlag:  defaultTLSKeyPath,
		},
		{
			name: "partial tls and ssl flags",
			args: []string{
				"portainer",
				"--tlsverify",
				"--tlscert=tls-cert-flag-value",
				"--sslkey=ssl-key-flag-value",
			},
			expectedTLSFlag:     true,
			expectedTLSCertFlag: "tls-cert-flag-value",
			expectedTLSKeyFlag:  "ssl-key-flag-value",
		},
		{
			name: "partial tls and ssl flags 2",
			args: []string{
				"portainer",
				"--ssl",
				"--tlscert=tls-cert-flag-value",
				"--sslkey=ssl-key-flag-value",
			},
			expectedTLSFlag:     true,
			expectedTLSCertFlag: "tls-cert-flag-value",
			expectedTLSKeyFlag:  "ssl-key-flag-value",
		},
		{
			name: "ssl flags",
			args: []string{
				"portainer",
				"--ssl",
				"--sslcert=ssl-cert-flag-value",
				"--sslkey=ssl-key-flag-value",
			},
			expectedTLSFlag:     true,
			expectedTLSCertFlag: "ssl-cert-flag-value",
			expectedTLSKeyFlag:  "ssl-key-flag-value",
			expectedLogMessages: []string{
				"the \\\"ssl\\\" flag is deprecated. use \\\"tlsverify\\\" instead.",
				"the \\\"sslcert\\\" flag is deprecated. use \\\"tlscert\\\" instead.",
				"the \\\"sslkey\\\" flag is deprecated. use \\\"tlskey\\\" instead.",
			},
		},
		{
			name: "tls flags",
			args: []string{
				"portainer",
				"--tlsverify",
				"--tlscert=tls-cert-flag-value",
				"--tlskey=tls-key-flag-value",
			},
			expectedTLSFlag:     true,
			expectedTLSCertFlag: "tls-cert-flag-value",
			expectedTLSKeyFlag:  "tls-key-flag-value",
		},
		{
			name: "tls and ssl flags",
			args: []string{
				"portainer",
				"--tlsverify",
				"--tlscert=tls-cert-flag-value",
				"--tlskey=tls-key-flag-value",
				"--ssl",
				"--sslcert=ssl-cert-flag-value",
				"--sslkey=ssl-key-flag-value",
			},
			expectedTLSFlag:     true,
			expectedTLSCertFlag: "tls-cert-flag-value",
			expectedTLSKeyFlag:  "tls-key-flag-value",
			expectedLogMessages: []string{
				"the \\\"ssl\\\" flag is deprecated. use \\\"tlsverify\\\" instead.",
				"the \\\"sslcert\\\" flag is deprecated. use \\\"tlscert\\\" instead.",
				"the \\\"sslkey\\\" flag is deprecated. use \\\"tlskey\\\" instead.",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var logOutput strings.Builder
			setupLogOutput(t, &logOutput)

			if tc.args == nil {
				tc.args = []string{"portainer"}
			}
			setOsArgs(t, tc.args)

			s := Service{}
			flags, err := s.ParseFlags("test-version")
			if err != nil {
				t.Fatalf("error parsing flags: %v", err)
			}

			if flags.TLS == nil {
				t.Fatal("TLS flag was nil")
			}

			require.Equal(t, tc.expectedTLSFlag, *flags.TLS, "tlsverify flag didn't match")
			require.Equal(t, tc.expectedTLSCertFlag, *flags.TLSCert, "tlscert flag didn't match")
			require.Equal(t, tc.expectedTLSKeyFlag, *flags.TLSKey, "tlskey flag didn't match")

			for _, expectedLogMessage := range tc.expectedLogMessages {
				require.Contains(t, logOutput.String(), expectedLogMessage, "Log didn't contain expected message")
			}
		})
	}
}

func setOsArgs(t *testing.T, args []string) {
	t.Helper()
	previousArgs := os.Args
	os.Args = args
	t.Cleanup(func() {
		os.Args = previousArgs
	})
}

func setupLogOutput(t *testing.T, w io.Writer) {
	t.Helper()

	oldLogger := zerolog.Logger
	zerolog.Logger = zerolog.Output(w)
	t.Cleanup(func() {
		zerolog.Logger = oldLogger
	})
}

func strPtr(s string) *string { return &s }
func boolPtr(b bool) *bool    { return &b }

func TestValidateFlags_LocalDefaultsOK(t *testing.T) {
	t.Parallel()
	svc := Service{}
	flags := &portainer.CLIFlags{
		EndpointURL:      strPtr(""),
		SnapshotInterval: strPtr(""),
		EdgePortainerURL: strPtr(""),
		NoAnalytics:      boolPtr(false),
	}
	require.NoError(t, svc.ValidateFlags(flags))
}

func TestValidateFlags_NoAnalyticsWarns(t *testing.T) {
	t.Parallel()
	svc := Service{}
	flags := &portainer.CLIFlags{
		EndpointURL:      strPtr("tcp://127.0.0.1:2375"),
		SnapshotInterval: strPtr("5m"),
		EdgePortainerURL: strPtr(""),
		NoAnalytics:      boolPtr(true),
	}
	require.NoError(t, svc.ValidateFlags(flags))
}

func TestValidateFlags_InvalidSnapshotInterval(t *testing.T) {
	t.Parallel()
	svc := Service{}
	flags := &portainer.CLIFlags{
		EndpointURL:      strPtr(""),
		SnapshotInterval: strPtr("not-a-duration"),
		EdgePortainerURL: strPtr(""),
		NoAnalytics:      boolPtr(false),
	}
	require.ErrorIs(t, svc.ValidateFlags(flags), ErrInvalidSnapshotInterval)
}

func TestValidateFlags_InvalidEndpointProtocol(t *testing.T) {
	t.Parallel()
	svc := Service{}
	flags := &portainer.CLIFlags{
		EndpointURL:      strPtr("http://example.com"),
		SnapshotInterval: strPtr(""),
		EdgePortainerURL: strPtr(""),
		NoAnalytics:      boolPtr(false),
	}
	require.ErrorIs(t, svc.ValidateFlags(flags), ErrInvalidEndpointProtocol)
}

func TestValidateEndpointURL_UnixSocketExists(t *testing.T) {
	t.Parallel()
	sock := t.TempDir() + "/docker.sock"
	require.NoError(t, os.WriteFile(sock, []byte{}, 0o600))
	require.NoError(t, ValidateEndpointURL("unix://"+sock))
}

func TestValidateEndpointURL_UnixSocketMissing(t *testing.T) {
	t.Parallel()
	require.ErrorIs(t, ValidateEndpointURL("unix:///no/such/docker.sock"), ErrSocketOrNamedPipeNotFound)
}

func TestValidateEndpointURL_TCPOK(t *testing.T) {
	t.Parallel()
	require.NoError(t, ValidateEndpointURL("tcp://127.0.0.1:2375"))
}

func TestValidateSnapshotInterval(t *testing.T) {
	t.Parallel()
	require.NoError(t, ValidateSnapshotInterval(""))
	require.NoError(t, ValidateSnapshotInterval("30s"))
	require.ErrorIs(t, ValidateSnapshotInterval("bogus"), ErrInvalidSnapshotInterval)
}

func TestPairList_SetAndString(t *testing.T) {
	t.Parallel()
	var l pairList
	require.NoError(t, l.Set("env=prod"))
	require.NoError(t, l.Set("tier=web"))
	require.Len(t, l, 2)
	require.Equal(t, "env", l[0].Name)
	require.Equal(t, "prod", l[0].Value)
	require.Error(t, l.Set("novalue"))
	require.Equal(t, "", l.String())
	require.True(t, l.IsCumulative())
}

func TestConfirm_YesAndNo(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"y\n", true},
		{"yes\n", true},
		{"Y\n", true},
		{"n\n", false},
		{"\n", false},
		{"maybe\n", false},
	}
	for _, tc := range cases {
		t.Run(strings.TrimSpace(tc.in), func(t *testing.T) {
			r, w, err := os.Pipe()
			require.NoError(t, err)
			old := os.Stdin
			os.Stdin = r
			t.Cleanup(func() {
				os.Stdin = old
				_ = r.Close()
			})
			_, err = io.WriteString(w, tc.in)
			require.NoError(t, err)
			require.NoError(t, w.Close())

			got, err := Confirm("proceed?")
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestConfirm_ReadError(t *testing.T) {
	r, w, err := os.Pipe()
	require.NoError(t, err)
	require.NoError(t, w.Close())
	require.NoError(t, r.Close())

	old := os.Stdin
	os.Stdin = r
	t.Cleanup(func() { os.Stdin = old })

	got, err := Confirm("fail?")
	require.Error(t, err)
	require.False(t, got)
}
