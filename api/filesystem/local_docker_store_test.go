package filesystem

import (
	"encoding/base64"
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
	require.Equal(t, filepath.Join(svc.fileStorePath, ComposeStorePath, "stack-1", "v2"), svc.GetStackProjectPathByVersion("stack-1", 2, ""))
	require.Equal(t, filepath.Join(svc.fileStorePath, ComposeStorePath, "stack-1", "abc123"), svc.GetStackProjectPathByVersion("stack-1", 2, "abc123"))

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

func TestREQ_STK_02_StoreStackFileByVersionAndRollback(t *testing.T) {
	t.Parallel()
	svc := createService(t)

	data := []byte("version: '3'\nservices: {}\n")
	_, err := svc.StoreStackFileFromBytesByVersion("stack-v", "compose.yml", 3, data)
	require.NoError(t, err)

	updated := []byte("version: '3.8'\nservices: {}\n")
	path, err := svc.UpdateStoreStackFileFromBytesByVersion("stack-v", "compose.yml", 3, "", updated)
	require.NoError(t, err)

	require.NoError(t, svc.RollbackStackFileByVersion("stack-v", 3, "compose.yml"))
	content, err := svc.GetFileContent(path, "compose.yml")
	require.NoError(t, err)
	require.Equal(t, data, content)

	require.NoError(t, svc.RemoveStackFileBackupByVersion("stack-v", 3, "compose.yml"))

	// no backup → rollback is a no-op
	require.NoError(t, svc.RollbackStackFileByVersion("stack-v", 3, "compose.yml"))
	require.NoError(t, svc.RollbackStackFile("missing", "compose.yml"))
}

func TestREQ_STK_03_FormProjectPathByVersion(t *testing.T) {
	t.Parallel()
	svc := createService(t)

	base := "/data/compose/app"
	require.Equal(t, base, svc.FormProjectPathByVersion(base, 0, ""))
	require.Equal(t, filepath.Join(base, "v4"), svc.FormProjectPathByVersion(base, 4, ""))
	require.Equal(t, filepath.Join(base, "deadbeef"), svc.FormProjectPathByVersion(base, 4, "deadbeef"))
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

	jsonPath := filepath.Join(t.TempDir(), "meta.json")
	require.NoError(t, svc.WriteJSONToFile(jsonPath, map[string]string{"k": "v"}))
	raw, err := os.ReadFile(jsonPath)
	require.NoError(t, err)
	require.Contains(t, string(raw), `"k":"v"`)

	created := filepath.Join(t.TempDir(), "created.bin")
	require.NoError(t, CreateFile(created, strings.NewReader("payload")))
	raw, err = os.ReadFile(created)
	require.NoError(t, err)
	require.Equal(t, "payload", string(raw))
}

func TestREQ_STK_02_PathsHelpersAndDirectories(t *testing.T) {
	t.Parallel()
	svc := createService(t)

	require.Equal(t, filepath.Join(svc.fileStorePath, BinaryStorePath), svc.GetBinaryFolder())
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

func TestREQ_STK_03_SerializeLoadPersistFilter(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(root, "sub"), 0755))
	require.NoError(t, os.WriteFile(filepath.Join(root, "docker-compose.yml"), []byte("services: {}\n"), 0600))
	require.NoError(t, os.WriteFile(filepath.Join(root, ".env"), []byte("A=1\n"), 0600))
	require.NoError(t, os.WriteFile(filepath.Join(root, "sub", "extra.yml"), []byte("x: 1\n"), 0600))

	entries, err := LoadDir(root)
	require.NoError(t, err)
	require.NotEmpty(t, entries)

	filtered := FilterDirForEntryFile(entries, "docker-compose.yml")
	names := make([]string, 0, len(filtered))
	for _, e := range filtered {
		names = append(names, e.Name)
	}
	require.Contains(t, names, "docker-compose.yml")
	require.Contains(t, names, ".env")

	decoded := append([]DirEntry(nil), entries...)
	require.NoError(t, DecodeDirEntries(decoded))
	for _, e := range decoded {
		if e.IsFile && e.Name == "docker-compose.yml" {
			require.Equal(t, "services: {}\n", e.Content)
		}
	}

	raw, err := DecodeFileContent(base64.StdEncoding.EncodeToString([]byte("hello")))
	require.NoError(t, err)
	require.Equal(t, "hello", raw)

	content, err := FilterDirForCompatibility(entries, "docker-compose.yml", "2.18.0")
	require.NoError(t, err)
	require.Equal(t, "services: {}\n", content)
	content, err = FilterDirForCompatibility(entries, "docker-compose.yml", "2.19.0")
	require.NoError(t, err)
	require.Equal(t, "", content)

	out := t.TempDir()
	// PersistDir writes Content as raw bytes (callers decode first).
	toPersist := []DirEntry{
		{Name: "a", IsFile: false, Permissions: 0755},
		{Name: "a/file.yml", IsFile: true, Content: "ok\n", Permissions: 0600},
	}
	require.NoError(t, PersistDir(out, toPersist))
	rawBytes, err := os.ReadFile(filepath.Join(out, "a", "file.yml"))
	require.NoError(t, err)
	require.Equal(t, "ok\n", string(rawBytes))
}

func TestREQ_STK_02_SafeMoveDirectory(t *testing.T) {
	t.Parallel()
	svc := createService(t)

	src := filepath.Join(t.TempDir(), "project")
	dst := filepath.Join(t.TempDir(), "project-v2")
	require.NoError(t, os.MkdirAll(src, 0755))
	require.NoError(t, os.WriteFile(filepath.Join(src, "docker-compose.yml"), []byte("services: {}\n"), 0600))

	require.NoError(t, svc.SafeMoveDirectory(src, dst))
	exists, err := FileExists(filepath.Join(dst, "docker-compose.yml"))
	require.NoError(t, err)
	require.True(t, exists)
	exists, err = FileExists(src)
	require.NoError(t, err)
	require.False(t, exists)
}

func TestJoinPaths_EmptyTrustedRoot(t *testing.T) {
	t.Parallel()
	require.Equal(t, filepath.Clean("foo/bar"), JoinPaths("", "foo", "bar"))
}
