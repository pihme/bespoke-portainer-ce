package storybook

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewHandler_ServesStorybookAssets(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	storyDir := filepath.Join(root, "storybook")
	require.NoError(t, os.MkdirAll(storyDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(storyDir, "hello.txt"), []byte("story-ok"), 0o644))

	h := NewHandler(root)
	require.NotNil(t, h)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/hello.txt", nil)
	h.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	require.Equal(t, "story-ok", rr.Body.String())
}

func TestNewHandler_MissingAsset(t *testing.T) {
	t.Parallel()

	h := NewHandler(t.TempDir())
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/missing.txt", nil)
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusNotFound, rr.Code)
}
