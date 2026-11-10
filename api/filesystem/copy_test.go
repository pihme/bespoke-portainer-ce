package filesystem

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_copyFile_returnsError_whenSourceDoesNotExist(t *testing.T) {
	t.Parallel()
	tmpdir := t.TempDir()
	err := copyFile("does-not-exist", tmpdir)
	require.Error(t, err)
}

func Test_copyFile_shouldMakeAbackup(t *testing.T) {
	t.Parallel()
	tmpdir := t.TempDir()
	content := []byte("content")

	err := os.WriteFile(JoinPaths(tmpdir, "origin"), content, 0600)
	require.NoError(t, err)

	err = copyFile(JoinPaths(tmpdir, "origin"), JoinPaths(tmpdir, "copy"))
	require.NoError(t, err)

	copyContent, err := os.ReadFile(JoinPaths(tmpdir, "copy"))
	require.NoError(t, err)
	assert.Equal(t, content, copyContent)
}

func Test_CopyDir_shouldCopyAllFilesAndDirectories(t *testing.T) {
	t.Parallel()
	destination := t.TempDir()
	err := CopyDir("./testdata/copy_test", destination, true)
	require.NoError(t, err)

	assert.FileExists(t, JoinPaths(destination, "copy_test", "outer"))
	assert.FileExists(t, JoinPaths(destination, "copy_test", "dir", ".dotfile"))
	assert.FileExists(t, JoinPaths(destination, "copy_test", "dir", "inner"))
}

func Test_CopyDir_shouldCopyOnlyDirContents(t *testing.T) {
	t.Parallel()
	destination := t.TempDir()
	err := CopyDir("./testdata/copy_test", destination, false)
	require.NoError(t, err)

	assert.FileExists(t, JoinPaths(destination, "outer"))
	assert.FileExists(t, JoinPaths(destination, "dir", ".dotfile"))
	assert.FileExists(t, JoinPaths(destination, "dir", "inner"))
}

func Test_copyFile_shouldKeepFileMode(t *testing.T) {
	t.Parallel()
	tmpdir := t.TempDir()

	err := os.WriteFile(JoinPaths(tmpdir, "script"), []byte("#!/bin/sh"), 0o755)
	require.NoError(t, err)

	err = copyFile(JoinPaths(tmpdir, "script"), JoinPaths(tmpdir, "copy"))
	require.NoError(t, err)

	info, err := os.Stat(JoinPaths(tmpdir, "copy"))
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0o755), info.Mode().Perm())
}
