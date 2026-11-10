package crypto

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"

	portainer "github.com/portainer/portainer/api"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func generateTestTLSMaterial(t *testing.T) (caPEM, certPEM, keyPEM []byte) {
	t.Helper()

	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	caTmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "test-ca"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		IsCA:                  true,
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
		BasicConstraintsValid: true,
	}
	caDER, err := x509.CreateCertificate(rand.Reader, caTmpl, caTmpl, &caKey.PublicKey, caKey)
	require.NoError(t, err)
	caPEM = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER})

	leafKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	leafTmpl := &x509.Certificate{
		SerialNumber: big.NewInt(2),
		Subject:      pkix.Name{CommonName: "localhost"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth},
	}
	leafDER, err := x509.CreateCertificate(rand.Reader, leafTmpl, caTmpl, &leafKey.PublicKey, caKey)
	require.NoError(t, err)
	certPEM = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: leafDER})

	keyBytes, err := x509.MarshalECPrivateKey(leafKey)
	require.NoError(t, err)
	keyPEM = pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyBytes})
	return caPEM, certPEM, keyPEM
}

func writeTLSFiles(t *testing.T, caPEM, certPEM, keyPEM []byte) (caPath, certPath, keyPath string) {
	t.Helper()
	dir := t.TempDir()
	caPath = filepath.Join(dir, "ca.pem")
	certPath = filepath.Join(dir, "cert.pem")
	keyPath = filepath.Join(dir, "key.pem")
	require.NoError(t, os.WriteFile(caPath, caPEM, 0o600))
	require.NoError(t, os.WriteFile(certPath, certPEM, 0o600))
	require.NoError(t, os.WriteFile(keyPath, keyPEM, 0o600))
	return caPath, certPath, keyPath
}

func TestREQ_ENV_11_CreateTLSConfigurationFromDisk_WithCertAndCA(t *testing.T) {
	t.Parallel()

	caPEM, certPEM, keyPEM := generateTestTLSMaterial(t)
	caPath, certPath, keyPath := writeTLSFiles(t, caPEM, certPEM, keyPEM)

	cfg, err := CreateTLSConfigurationFromDisk(portainer.TLSConfiguration{
		TLS:           true,
		TLSSkipVerify: false,
		TLSCACertPath: caPath,
		TLSCertPath:   certPath,
		TLSKeyPath:    keyPath,
	})
	require.NoError(t, err)
	require.NotNil(t, cfg)
	require.Len(t, cfg.Certificates, 1)
	require.NotNil(t, cfg.RootCAs)
	assert.False(t, cfg.InsecureSkipVerify) //nolint:forbidigo
}

func TestREQ_ENV_11_CreateTLSConfigurationFromDisk_CertOnlySkipVerify(t *testing.T) {
	t.Parallel()

	_, certPEM, keyPEM := generateTestTLSMaterial(t)
	_, certPath, keyPath := writeTLSFiles(t, nil, certPEM, keyPEM)

	cfg, err := CreateTLSConfigurationFromDisk(portainer.TLSConfiguration{
		TLS:           true,
		TLSSkipVerify: true,
		TLSCertPath:   certPath,
		TLSKeyPath:    keyPath,
	})
	require.NoError(t, err)
	require.NotNil(t, cfg)
	require.Len(t, cfg.Certificates, 1)
	require.Nil(t, cfg.RootCAs)
}

func TestREQ_ENV_11_CreateTLSConfigurationFromDisk_MissingKeyPair(t *testing.T) {
	t.Parallel()

	_, err := CreateTLSConfigurationFromDisk(portainer.TLSConfiguration{
		TLS:         true,
		TLSCertPath: filepath.Join(t.TempDir(), "missing-cert.pem"),
		TLSKeyPath:  filepath.Join(t.TempDir(), "missing-key.pem"),
	})
	require.Error(t, err)
}

func TestREQ_ENV_11_CreateTLSConfigurationFromDisk_MissingCA(t *testing.T) {
	t.Parallel()

	_, certPEM, keyPEM := generateTestTLSMaterial(t)
	_, certPath, keyPath := writeTLSFiles(t, nil, certPEM, keyPEM)

	_, err := CreateTLSConfigurationFromDisk(portainer.TLSConfiguration{
		TLS:           true,
		TLSSkipVerify: false,
		TLSCACertPath: filepath.Join(t.TempDir(), "missing-ca.pem"),
		TLSCertPath:   certPath,
		TLSKeyPath:    keyPath,
	})
	require.Error(t, err)
}

func TestREQ_ENV_11_CreateTLSConfigurationFromDisk_FIPSRequiresTLS(t *testing.T) {
	t.Parallel()

	cfg, err := createTLSConfigurationFromDisk(true, portainer.TLSConfiguration{TLS: false})
	require.Error(t, err)
	require.Nil(t, cfg)
}

func TestREQ_SET_04_CreateTLSConfiguration_InsecureFlag(t *testing.T) {
	t.Parallel()

	secure := CreateTLSConfiguration(false)
	require.False(t, secure.InsecureSkipVerify) //nolint:forbidigo
	require.NotEmpty(t, secure.CipherSuites)

	insecure := CreateTLSConfiguration(true)
	require.True(t, insecure.InsecureSkipVerify) //nolint:forbidigo
}
