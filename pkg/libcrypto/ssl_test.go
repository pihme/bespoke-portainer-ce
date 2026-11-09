package libcrypto

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestGenerateCertsForHost(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	certPath := filepath.Join(dir, "cert.pem")
	keyPath := filepath.Join(dir, "key.pem")

	err := GenerateCertsForHost("localhost", "127.0.0.1", certPath, keyPath, time.Now().Add(24*time.Hour))
	require.NoError(t, err)

	certInfo, err := os.Stat(certPath)
	require.NoError(t, err)
	require.Greater(t, certInfo.Size(), int64(0))
	keyInfo, err := os.Stat(keyPath)
	require.NoError(t, err)
	require.Greater(t, keyInfo.Size(), int64(0))
}

func TestGenerateCertsForHost_InvalidIP(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	err := GenerateCertsForHost("host", "not-an-ip", filepath.Join(dir, "c.pem"), filepath.Join(dir, "k.pem"), time.Now().Add(time.Hour))
	require.EqualError(t, err, "Failed parsing host ip")
}

func TestGenerateCertsForHost_BadCertPath(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	err := GenerateCertsForHost("localhost", "127.0.0.1", filepath.Join(dir, "missing", "cert.pem"), filepath.Join(dir, "key.pem"), time.Now().Add(time.Hour))
	require.Error(t, err)
}

func TestDecrypt_MalformedCiphertext(t *testing.T) {
	t.Parallel()
	_, err := decrypt([]byte{1}, []byte("key"), false)
	require.EqualError(t, err, "malformed ciphertext")
}
