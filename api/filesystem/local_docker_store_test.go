package filesystem

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	portainer "github.com/portainer/portainer/api"

	"github.com/stretchr/testify/require"
)

func TestREQ_STK_02_StoreAndUpdateStackFiles(t *testing.T) {
	t.Parallel()
	svc := createService(t)

	compose := []byte("services:\n  web:\n    image: nginx\n")
	path, err := svc.StoreStackFileFromBytes("stack-1", ComposeFileDefaultName, compose)
	require.NoError(t, err)
	require.Contains(t, path, filepath.Join(ComposeStorePath, "stack-1"))

	content, err := svc.GetFileContent(path, ComposeFileDefaultName)
	require.NoError(t, err)
	require.Equal(t, compose, content)

	require.Equal(t, filepath.Join(svc.fileStorePath, ComposeStorePath, "stack-1"), svc.GetStackProjectPath("stack-1"))

	updated := []byte("services:\n  web:\n    image: nginx:alpine\n")
	_, err = svc.UpdateStoreStackFileFromBytes("stack-1", ComposeFileDefaultName, updated)
	require.NoError(t, err)
	content, err = svc.GetFileContent(path, ComposeFileDefaultName)
	require.NoError(t, err)
	require.Equal(t, updated, content)

	require.NoError(t, svc.RollbackStackFile("stack-1", ComposeFileDefaultName))
	content, err = svc.GetFileContent(path, ComposeFileDefaultName)
	require.NoError(t, err)
	require.Equal(t, compose, content)

	require.NoError(t, svc.RemoveStackFileBackup("stack-1", ComposeFileDefaultName))
}

func TestREQ_SET_04_TLSFileStoreLifecycle(t *testing.T) {
	t.Parallel()
	svc := createService(t)

	folder := "endpoint-1"
	caPath, err := svc.StoreTLSFileFromBytes(folder, portainer.TLSFileCA, []byte("CA"))
	require.NoError(t, err)
	certPath, err := svc.StoreTLSFileFromBytes(folder, portainer.TLSFileCert, []byte("CERT"))
	require.NoError(t, err)
	keyPath, err := svc.StoreTLSFileFromBytes(folder, portainer.TLSFileKey, []byte("KEY"))
	require.NoError(t, err)

	got, err := svc.GetPathForTLSFile(folder, portainer.TLSFileCA)
	require.NoError(t, err)
	require.Equal(t, caPath, got)
	got, err = svc.GetPathForTLSFile(folder, portainer.TLSFileCert)
	require.NoError(t, err)
	require.Equal(t, certPath, got)
	got, err = svc.GetPathForTLSFile(folder, portainer.TLSFileKey)
	require.NoError(t, err)
	require.Equal(t, keyPath, got)

	_, err = svc.StoreTLSFileFromBytes(folder, portainer.TLSFileType(99), []byte("x"))
	require.ErrorIs(t, err, ErrUndefinedTLSFileType)
	_, err = svc.GetPathForTLSFile(folder, portainer.TLSFileType(99))
	require.ErrorIs(t, err, ErrUndefinedTLSFileType)
	require.ErrorIs(t, svc.DeleteTLSFile(folder, portainer.TLSFileType(99)), ErrUndefinedTLSFileType)

	require.NoError(t, svc.DeleteTLSFile(folder, portainer.TLSFileKey))
	exists, err := svc.FileExists(keyPath)
	require.NoError(t, err)
	require.False(t, exists)

	require.NoError(t, svc.DeleteTLSFiles(folder))
	exists, err = svc.FileExists(filepath.Dir(caPath))
	require.NoError(t, err)
	require.False(t, exists)
}

func TestREQ_TPL_03_StoreCustomTemplateFile(t *testing.T) {
	t.Parallel()
	svc := createService(t)

	path, err := svc.StoreCustomTemplateFileFromBytes("42", "template.yml", []byte("services: {}\n"))
	require.NoError(t, err)
	require.Equal(t, svc.GetCustomTemplateProjectPath("42"), path)

	content, err := svc.GetFileContent(path, "template.yml")
	require.NoError(t, err)
	require.Equal(t, []byte("services: {}\n"), content)
}

func TestREQ_STK_04_CopyRenameWriteJSONAndCreateFile(t *testing.T) {
	t.Parallel()
	svc := createService(t)

	src := filepath.Join(t.TempDir(), "src.txt")
	dst := filepath.Join(t.TempDir(), "dst.txt")
	require.NoError(t, os.WriteFile(src, []byte("hello"), 0600))

	require.Error(t, svc.Copy(filepath.Join(t.TempDir(), "missing"), dst, false))
	require.NoError(t, svc.Copy(src, dst, false))
	require.Error(t, svc.Copy(src, dst, false)) // exists, no delete
	require.NoError(t, svc.Copy(src, dst, true))

	renamed := dst + ".renamed"
	require.NoError(t, svc.Rename(dst, renamed))
	exists, err := svc.FileExists(renamed)
	require.NoError(t, err)
	require.True(t, exists)

	created := filepath.Join(t.TempDir(), "created.bin")
	require.NoError(t, CreateFile(created, strings.NewReader("payload")))
	raw, err := os.ReadFile(created)
	require.NoError(t, err)
	require.Equal(t, "payload", string(raw))
}

func TestREQ_STK_02_PathsHelpersAndDirectories(t *testing.T) {
	t.Parallel()
	svc := createService(t)

	require.Equal(t, svc.dataStorePath, svc.GetDatastorePath())
	tmp, err := svc.GetTemporaryPath()
	require.NoError(t, err)
	require.Contains(t, tmp, TempPath)
	require.NoError(t, os.MkdirAll(tmp, 0755))
	require.NoError(t, svc.RemoveDirectory(tmp))
	exists, err := FileExists(tmp)
	require.NoError(t, err)
	require.False(t, exists)
}

func TestREQ_STK_02_KeyPairStoreAndLoad(t *testing.T) {
	t.Parallel()
	svc := createService(t)

	exists, err := svc.KeyPairFilesExist()
	require.NoError(t, err)
	require.False(t, exists)

	require.NoError(t, svc.StoreKeyPair([]byte("priv"), []byte("pub"), "RSA PRIVATE KEY", "PUBLIC KEY"))
	exists, err = svc.KeyPairFilesExist()
	require.NoError(t, err)
	require.True(t, exists)

	priv, pub, err := svc.LoadKeyPair()
	require.NoError(t, err)
	require.Equal(t, []byte("priv"), priv)
	require.Equal(t, []byte("pub"), pub)
}

func TestREQ_SET_04_SSLCertPathsAndStore(t *testing.T) {
	t.Parallel()
	svc := createService(t)

	certPath, keyPath := svc.GetDefaultSSLCertsPath()
	require.Contains(t, certPath, SSLCertFilename)
	require.Contains(t, keyPath, SSLKeyFilename)

	storedCert, storedKey, err := svc.StoreSSLCertPair([]byte("cert-bytes"), []byte("key-bytes"))
	require.NoError(t, err)
	require.Equal(t, certPath, storedCert)
	require.Equal(t, keyPath, storedKey)

	raw, err := os.ReadFile(certPath)
	require.NoError(t, err)
	require.Equal(t, []byte("cert-bytes"), raw)
}

func TestJoinPaths_EmptyTrustedRoot(t *testing.T) {
	t.Parallel()
	require.Equal(t, filepath.Clean("foo/bar"), JoinPaths("", "foo", "bar"))
}
