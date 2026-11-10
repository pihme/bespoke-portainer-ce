//go:build !windows

package cli

const (
	defaultBindAddress            = ":9000"
	defaultHTTPSBindAddress       = ":9443"
	defaultDataDirectory          = "/data"
	defaultAssetsDirectory        = "./"
	defaultTLS                    = "false"
	defaultTLSSkipVerify          = "false"
	defaultTLSCACertPath          = "/certs/ca.pem"
	defaultTLSCertPath            = "/certs/cert.pem"
	defaultTLSKeyPath             = "/certs/key.pem"
	defaultHTTPDisabled           = "false"
	defaultHTTPEnabled            = "false"
	defaultSSL                    = "false"
	defaultBaseURL                = "/"
	defaultSecretKeyName          = "portainer"
	defaultMaxBatchSize           = "1000"
	defaultMaxBatchDelay          = "20ms"
)
