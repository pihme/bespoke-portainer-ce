package update

import (
	"errors"
	"os"
	"testing"
	"time"

	"github.com/portainer/portainer/api/filesystem"

	"github.com/stretchr/testify/require"
)

func TestTmpClonesClone(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	_, tc := WithTmpClones(t.Context())

	req := RepoRequest{URL: "https://example.com/r.git"}
	calls := 0
	clone := func(dst string) error {
		calls++

		if err := os.MkdirAll(filesystem.JoinPaths(dst, "sub"), 0o755); err != nil {
			return err
		}

		if err := os.WriteFile(filesystem.JoinPaths(dst, "sub", "run.sh"), []byte("#!/bin/sh"), 0o755); err != nil {
			return err
		}

		return os.WriteFile(filesystem.JoinPaths(dst, "compose.yml"), []byte("services: {}"), 0o644)
	}

	// two consumers of the same commit trigger a single clone
	for _, name := range []string{"a", "b"} {
		err := tc.Clone(req, "h1", root, filesystem.JoinPaths(root, name, "h1"), clone)
		require.NoError(t, err)
	}

	require.Equal(t, 1, calls)

	for _, name := range []string{"a", "b"} {
		content, err := os.ReadFile(filesystem.JoinPaths(root, name, "h1", "compose.yml"))
		require.NoError(t, err)
		require.Equal(t, "services: {}", string(content))

		info, err := os.Stat(filesystem.JoinPaths(root, name, "h1", "sub", "run.sh"))
		require.NoError(t, err)
		require.Equal(t, os.FileMode(0o755), info.Mode().Perm())
	}

	// a different commit clones again
	err := tc.Clone(req, "h2", root, filesystem.JoinPaths(root, "a", "h2"), clone)
	require.NoError(t, err)
	require.Equal(t, 2, calls)

	// a failed clone is remembered
	failReq := RepoRequest{URL: "https://example.com/bad.git"}
	failCalls := 0
	failClone := func(string) error {
		failCalls++

		return errors.New("boom")
	}

	for range 2 {
		err := tc.Clone(failReq, "h1", root, filesystem.JoinPaths(root, "c", "h1"), failClone)
		require.Error(t, err)
	}

	require.Equal(t, 1, failCalls)

	// closing removes every temporary clone, including the partial one of the failure
	tc.Close()

	entries, err := os.ReadDir(root)
	require.NoError(t, err)

	for _, e := range entries {
		require.NotContains(t, e.Name(), tmpCloneDirPrefix)
	}

	// nil TmpClones clones straight into the destination
	var nilClones *TmpClones
	dst := filesystem.JoinPaths(root, "direct")
	err = nilClones.Clone(req, "h1", root, dst, clone)
	require.NoError(t, err)
	require.FileExists(t, filesystem.JoinPaths(dst, "compose.yml"))
}

func TestTmpClonesRemovesStaleLeftovers(t *testing.T) {
	t.Parallel()

	root := t.TempDir()

	stale := filesystem.JoinPaths(root, tmpCloneDirPrefix+"stale")
	err := os.Mkdir(stale, 0o755)
	require.NoError(t, err)

	old := time.Now().Add(-2 * staleTmpCloneAge)
	err = os.Chtimes(stale, old, old)
	require.NoError(t, err)

	fresh := filesystem.JoinPaths(root, tmpCloneDirPrefix+"fresh")
	err = os.Mkdir(fresh, 0o755)
	require.NoError(t, err)

	other := filesystem.JoinPaths(root, "unrelated")
	err = os.Mkdir(other, 0o755)
	require.NoError(t, err)

	err = os.Chtimes(other, old, old)
	require.NoError(t, err)

	_, tc := WithTmpClones(t.Context())
	defer tc.Close()

	req := RepoRequest{URL: "https://example.com/r.git"}
	err = tc.Clone(req, "h1", root, filesystem.JoinPaths(root, "dst"), func(dst string) error {
		return os.WriteFile(filesystem.JoinPaths(dst, "f"), nil, 0o644)
	})
	require.NoError(t, err)

	// only the old temporary clone is removed, a recent one may belong to a tick in progress
	require.NoDirExists(t, stale)
	require.DirExists(t, fresh)
	require.DirExists(t, other)
}

func TestTmpClonesAfterClose(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	_, tc := WithTmpClones(t.Context())

	req := RepoRequest{URL: "https://example.com/r.git"}
	clones := 0
	clone := func(dst string) error {
		clones++

		return os.WriteFile(filesystem.JoinPaths(dst, "compose.yml"), nil, 0o644)
	}

	err := tc.Clone(req, "abc", root, filesystem.JoinPaths(root, "before"), clone)
	require.NoError(t, err)
	require.Equal(t, 1, clones)

	tc.Close()

	// a deployment that outlives the poll does not reuse the removed checkout
	after := filesystem.JoinPaths(root, "after")
	err = os.MkdirAll(after, 0o755)
	require.NoError(t, err)

	err = tc.Clone(req, "abc", root, after, clone)
	require.NoError(t, err)
	require.Equal(t, 2, clones)
	require.FileExists(t, filesystem.JoinPaths(after, "compose.yml"))

	// and it leaves no temporary clone behind
	entries, err := os.ReadDir(root)
	require.NoError(t, err)

	for _, e := range entries {
		require.NotContains(t, e.Name(), tmpCloneDirPrefix)
	}
}
