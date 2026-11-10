package archive

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTarFileInBuffer(t *testing.T) {
	t.Parallel()
	content := []byte("hello stack")
	data, err := TarFileInBuffer(content, "compose.yml", 0o644)
	require.NoError(t, err)

	tr := tar.NewReader(bytes.NewReader(data))
	hdr, err := tr.Next()
	require.NoError(t, err)
	require.Equal(t, "compose.yml", hdr.Name)
	require.Equal(t, int64(0o644), hdr.Mode)
	got, err := io.ReadAll(tr)
	require.NoError(t, err)
	require.Equal(t, content, got)
	_, err = tr.Next()
	require.ErrorIs(t, err, io.EOF)
}

func TestTarFileInBufferBuilder(t *testing.T) {
	t.Parallel()
	buf := NewTarFileInBuffer()
	require.NoError(t, buf.Put([]byte("a"), "a.txt", 0o600))
	require.NoError(t, buf.Put([]byte("bb"), "b.txt", 0o644))
	require.NoError(t, buf.Close())

	tr := tar.NewReader(bytes.NewReader(buf.Bytes()))
	names := map[string]string{}
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		require.NoError(t, err)
		body, err := io.ReadAll(tr)
		require.NoError(t, err)
		names[hdr.Name] = string(body)
	}
	require.Equal(t, map[string]string{"a.txt": "a", "b.txt": "bb"}, names)
}

func TestUnzipFile_MissingAndDirectoryEntry(t *testing.T) {
	t.Parallel()
	require.Error(t, UnzipFile(filepath.Join(t.TempDir(), "missing.zip"), t.TempDir()))

	src := filepath.Join(t.TempDir(), "withdir.zip")
	zf, err := os.Create(src)
	require.NoError(t, err)
	w := zip.NewWriter(zf)
	_, err = w.Create("nested/")
	require.NoError(t, err)
	fw, err := w.Create("nested/file.txt")
	require.NoError(t, err)
	_, err = fw.Write([]byte("payload"))
	require.NoError(t, err)
	require.NoError(t, w.Close())
	require.NoError(t, zf.Close())

	dest := t.TempDir()
	require.NoError(t, UnzipFile(src, dest))
	require.DirExists(t, filepath.Join(dest, "nested"))
	require.FileExists(t, filepath.Join(dest, "nested", "file.txt"))
}
