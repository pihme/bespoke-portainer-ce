package ssl

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/pkg/libcrypto"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Phase C tests for api/internal/ssl — local TLS/certificate helpers (REQ-SRV-05, REQ-SET-04).

type failingCopyFileService struct {
	*filesystem.Service
	copyErr error
}

func (f *failingCopyFileService) CopySSLCertPair(certPath, keyPath string) (string, string, error) {
	if f.copyErr != nil {
		return "", "", f.copyErr
	}
	return f.Service.CopySSLCertPair(certPath, keyPath)
}

type failingStoreFileService struct {
	*filesystem.Service
	storeErr error
}

func (f *failingStoreFileService) StoreSSLCertPair(cert, key []byte) (string, string, error) {
	if f.storeErr != nil {
		return "", "", f.storeErr
	}
	return f.Service.StoreSSLCertPair(cert, key)
}

func newFS(t *testing.T) *filesystem.Service {
	t.Helper()
	fs, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	return fs
}

func writeTempCertPair(t *testing.T) (certPath, keyPath string) {
	t.Helper()
	dir := t.TempDir()
	certPath = filepath.Join(dir, "cert.pem")
	keyPath = filepath.Join(dir, "key.pem")
	require.NoError(t, libcrypto.GenerateCertsForHost("localhost", "127.0.0.1", certPath, keyPath, time.Now().AddDate(1, 0, 0)))
	return certPath, keyPath
}

func TestREQ_SRV_05_NewService_WiresDependencies(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs := newFS(t)
	triggered := false
	svc := NewService(fs, store, func() { triggered = true })

	require.NotNil(t, svc)
	assert.Same(t, fs, svc.fileService)
	assert.Same(t, store, svc.dataStore)
	assert.Nil(t, svc.rawCert)
	svc.shutdownTrigger()
	assert.True(t, triggered)
}

func TestREQ_SRV_05_Init_SuppliedCertsAreCopiedAndCached(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs := newFS(t)
	certPath, keyPath := writeTempCertPair(t)

	svc := NewService(fs, store, func() {})
	require.NoError(t, svc.Init("127.0.0.1", certPath, keyPath))

	settings, err := svc.GetSSLSettings()
	require.NoError(t, err)
	assert.NotEmpty(t, settings.CertPath)
	assert.NotEmpty(t, settings.KeyPath)
	assert.False(t, settings.SelfSigned)
	assert.FileExists(t, settings.CertPath)
	require.NotNil(t, svc.GetRawCertificate())
}

func TestREQ_SRV_05_Init_CopyFailureIsWrapped(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs := newFS(t)
	certPath, keyPath := writeTempCertPair(t)

	svc := NewService(&failingCopyFileService{Service: fs, copyErr: assert.AnError}, store, func() {})
	err := svc.Init("127.0.0.1", certPath, keyPath)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed copying supplied certs")
}

func TestREQ_SRV_05_Init_ExistingSettingsCertsAreCached(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs := newFS(t)
	certPath, keyPath := writeTempCertPair(t)

	require.NoError(t, store.SSLSettings().UpdateSettings(&portainer.SSLSettings{
		CertPath:   certPath,
		KeyPath:    keyPath,
		SelfSigned: false,
	}))

	svc := NewService(fs, store, func() {})
	require.NoError(t, svc.Init("127.0.0.1", "", ""))

	require.NotNil(t, svc.GetRawCertificate())
	settings, err := svc.GetSSLSettings()
	require.NoError(t, err)
	assert.Equal(t, certPath, settings.CertPath)
	assert.Equal(t, keyPath, settings.KeyPath)
}

func TestREQ_SRV_05_Init_MissingSettingsCertsGenerateSelfSigned(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs := newFS(t)

	missingCert := filepath.Join(t.TempDir(), "missing-cert.pem")
	missingKey := filepath.Join(t.TempDir(), "missing-key.pem")
	require.NoError(t, store.SSLSettings().UpdateSettings(&portainer.SSLSettings{
		CertPath: missingCert,
		KeyPath:  missingKey,
	}))

	svc := NewService(fs, store, func() {})
	require.NoError(t, svc.Init("127.0.0.1", "", ""))

	settings, err := svc.GetSSLSettings()
	require.NoError(t, err)
	assert.True(t, settings.SelfSigned)
	assert.FileExists(t, settings.CertPath)
	assert.FileExists(t, settings.KeyPath)
	require.NotNil(t, svc.GetRawCertificate())
}

func TestREQ_SRV_05_Init_NoCertsGenerateSelfSigned(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs := newFS(t)

	svc := NewService(fs, store, func() {})
	require.NoError(t, svc.Init("127.0.0.1", "", ""))

	settings, err := svc.GetSSLSettings()
	require.NoError(t, err)
	assert.True(t, settings.SelfSigned)
	assert.NotEmpty(t, settings.CertPath)
	assert.NotEmpty(t, settings.KeyPath)
	require.NotNil(t, svc.GetRawCertificate())
}

func TestREQ_SRV_05_Init_EmptyHostRejectsSelfSignedGeneration(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs := newFS(t)

	svc := NewService(fs, store, func() {})
	err := svc.Init("", "", "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed generating self signed certs")
	assert.Contains(t, err.Error(), "host can't be empty")
}

func TestREQ_SRV_05_Init_CorruptExistingCertSurfacesError(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs := newFS(t)

	dir := t.TempDir()
	certPath := filepath.Join(dir, "bad-cert.pem")
	keyPath := filepath.Join(dir, "bad-key.pem")
	require.NoError(t, os.WriteFile(certPath, []byte("not-a-cert"), 0o600))
	require.NoError(t, os.WriteFile(keyPath, []byte("not-a-key"), 0o600))

	require.NoError(t, store.SSLSettings().UpdateSettings(&portainer.SSLSettings{
		CertPath: certPath,
		KeyPath:  keyPath,
	}))

	svc := NewService(fs, store, func() {})
	err := svc.Init("127.0.0.1", "", "")
	require.Error(t, err)
	assert.False(t, os.IsNotExist(err))
}

func TestREQ_SET_04_SetCertificates_RejectsMissingOrInvalid(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs := newFS(t)
	svc := NewService(fs, store, func() {})

	err := svc.SetCertificates(nil, []byte("key"))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing certificate files")

	err = svc.SetCertificates([]byte("cert"), nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "missing certificate files")

	err = svc.SetCertificates([]byte("not-pem"), []byte("not-pem"))
	require.Error(t, err)
}

func TestREQ_SET_04_SetCertificates_StoresCachesAndTriggersShutdown(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs := newFS(t)
	certPath, keyPath := writeTempCertPair(t)
	certData, err := os.ReadFile(certPath)
	require.NoError(t, err)
	keyData, err := os.ReadFile(keyPath)
	require.NoError(t, err)

	shutdowns := 0
	svc := NewService(fs, store, func() { shutdowns++ })
	require.NoError(t, svc.SetCertificates(certData, keyData))

	settings, err := svc.GetSSLSettings()
	require.NoError(t, err)
	assert.False(t, settings.SelfSigned)
	assert.FileExists(t, settings.CertPath)
	require.NotNil(t, svc.GetRawCertificate())
	assert.Equal(t, 1, shutdowns)
}

func TestREQ_SET_04_SetCertificates_StoreFailurePropagates(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs := newFS(t)
	certPath, keyPath := writeTempCertPair(t)
	certData, err := os.ReadFile(certPath)
	require.NoError(t, err)
	keyData, err := os.ReadFile(keyPath)
	require.NoError(t, err)

	svc := NewService(&failingStoreFileService{Service: fs, storeErr: assert.AnError}, store, func() {})
	err = svc.SetCertificates(certData, keyData)
	require.Error(t, err)
	assert.ErrorIs(t, err, assert.AnError)
}

func TestREQ_SET_04_SetHTTPEnabled_NoOpWhenUnchanged(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs := newFS(t)

	settings, err := store.SSLSettings().Settings()
	require.NoError(t, err)
	settings.HTTPEnabled = true
	require.NoError(t, store.SSLSettings().UpdateSettings(settings))

	shutdowns := 0
	svc := NewService(fs, store, func() { shutdowns++ })
	require.NoError(t, svc.SetHTTPEnabled(true))
	assert.Equal(t, 0, shutdowns)
}

func TestREQ_SET_04_SetHTTPEnabled_UpdatesAndTriggersShutdown(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs := newFS(t)

	settings, err := store.SSLSettings().Settings()
	require.NoError(t, err)
	settings.HTTPEnabled = true
	require.NoError(t, store.SSLSettings().UpdateSettings(settings))

	shutdowns := 0
	svc := NewService(fs, store, func() { shutdowns++ })
	require.NoError(t, svc.SetHTTPEnabled(false))

	updated, err := svc.GetSSLSettings()
	require.NoError(t, err)
	assert.False(t, updated.HTTPEnabled)
	assert.Equal(t, 1, shutdowns)
}

func TestREQ_SRV_05_GetRawCertificate_NilUntilCached(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs := newFS(t)
	svc := NewService(fs, store, func() {})
	assert.Nil(t, svc.GetRawCertificate())

	require.NoError(t, svc.Init("127.0.0.1", "", ""))
	raw := svc.GetRawCertificate()
	require.NotNil(t, raw)
	assert.NotEmpty(t, raw.Certificate)
}

func TestGenerateSelfSignedCertificates_EmptyHost(t *testing.T) {
	t.Parallel()
	err := generateSelfSignedCertificates("", "/tmp/x.pem", "/tmp/y.pem")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "host can't be empty")
}

func TestCacheCertificate_InvalidPair(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	fs := newFS(t)
	svc := NewService(fs, store, func() {})

	dir := t.TempDir()
	certPath := filepath.Join(dir, "c.pem")
	keyPath := filepath.Join(dir, "k.pem")
	require.NoError(t, os.WriteFile(certPath, []byte("bad"), 0o600))
	require.NoError(t, os.WriteFile(keyPath, []byte("bad"), 0o600))

	err := svc.cacheCertificate(certPath, keyPath)
	require.Error(t, err)
	assert.Nil(t, svc.rawCert)
}
