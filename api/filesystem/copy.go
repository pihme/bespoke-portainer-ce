package filesystem

import (
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/portainer/portainer/api/logs"
)

// CopyDir copies contents of fromDir to toDir.
// When keepParent is true, contents will be copied with their immediate parent dir,
// i.e. given /from/dirA and /to/dirB with keepParent == true, result will be /to/dirB/dirA/<children>
func CopyDir(fromDir, toDir string, keepParent bool) error {
	cleanedSourcePath := filepath.Clean(fromDir)
	parentDirectory := filepath.Dir(cleanedSourcePath)
	err := filepath.Walk(cleanedSourcePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		var destination string
		if keepParent {
			destination = JoinPaths(toDir, strings.TrimPrefix(path, parentDirectory))
		} else {
			destination = JoinPaths(toDir, strings.TrimPrefix(path, cleanedSourcePath))
		}

		if destination == "" {
			return nil
		}

		if info.IsDir() {
			return nil // skip directory creations
		}

		if !info.Mode().IsRegular() { // skip symlinks, FIFOs, sockets, devices
			return nil
		}

		return copyFile(path, destination)
	})

	return err
}

// copies regular a file from src to dst
func copyFile(src, dst string) error {
	from, err := os.Open(src)
	if err != nil {
		return err
	}
	defer logs.CloseAndLogErr(from)

	// has to include 'execute' bit, otherwise fails. MkdirAll follows `mkdir -m` restrictions
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}
	info, err := from.Stat()
	if err != nil {
		return err
	}

	to, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, info.Mode().Perm())
	if err != nil {
		return err
	}
	defer logs.CloseAndLogErr(to)

	_, err = io.Copy(to, from)
	return err
}
