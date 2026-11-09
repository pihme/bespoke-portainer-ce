package archive

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
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

func TestExtractTarGz_DirectoryAndUnknownType(t *testing.T) {
	t.Parallel()

	var raw bytes.Buffer
	gz := gzip.NewWriter(&raw)
	tw := tar.NewWriter(gz)
	require.NoError(t, tw.WriteHeader(&tar.Header{Name: "subdir/", Typeflag: tar.TypeDir, Mode: 0o755}))
	content := []byte("ok")
	require.NoError(t, tw.WriteHeader(&tar.Header{
		Name: "subdir/f.txt", Typeflag: tar.TypeReg, Mode: 0o644, Size: int64(len(content)),
	}))
	_, err := tw.Write(content)
	require.NoError(t, err)
	require.NoError(t, tw.Close())
	require.NoError(t, gz.Close())

	out := t.TempDir()
	require.NoError(t, ExtractTarGz(bytes.NewReader(raw.Bytes()), out))
	require.FileExists(t, filepath.Join(out, "subdir", "f.txt"))

	var evil bytes.Buffer
	gz2 := gzip.NewWriter(&evil)
	tw2 := tar.NewWriter(gz2)
	require.NoError(t, tw2.WriteHeader(&tar.Header{Name: "link", Typeflag: tar.TypeSymlink, Linkname: "x", Mode: 0o644}))
	require.NoError(t, tw2.Close())
	require.NoError(t, gz2.Close())
	err = ExtractTarGz(bytes.NewReader(evil.Bytes()), t.TempDir())
	require.Error(t, err)
	require.Contains(t, err.Error(), "unknown type")
}

func TestExtractTarGz_BadGzip(t *testing.T) {
	t.Parallel()
	require.Error(t, ExtractTarGz(bytes.NewReader([]byte("not-gzip")), t.TempDir()))
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
