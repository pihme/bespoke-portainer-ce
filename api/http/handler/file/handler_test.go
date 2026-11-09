package file_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/portainer/portainer/api/http/handler/file"
	"github.com/stretchr/testify/require"
)

func TestNormalServe(t *testing.T) {
	t.Parallel()
	handler := file.NewHandler("", false)
	require.NotNil(t, handler)

	request := func(path string) (*http.Request, *httptest.ResponseRecorder) {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, path, nil)
		handler.ServeHTTP(rr, req)
		return req, rr
	}

	_, rr := request("/")
	require.Equal(t, http.StatusOK, rr.Result().StatusCode)
}

// TAI-001: there is no admin-init timeout, so the timeout page is no longer
// special and the UI root is never redirected to it.
func TestREQ_TAI_001_NoAdminInitTimeoutRedirect(t *testing.T) {
	t.Parallel()
	handler := file.NewHandler("", false)

	for _, path := range []string{"/", "/timeout.html"} {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, path, nil)
		handler.ServeHTTP(rr, req)

		require.NotEqual(t, http.StatusTemporaryRedirect, rr.Result().StatusCode, path)
		require.Empty(t, rr.Result().Header.Get("Location"), path)
	}
}

func TestPermissionsPolicyHeader(t *testing.T) {
	t.Parallel()
	handler := file.NewHandler("", false)
	require.NotNil(t, handler)

	test := func(path string, exist bool) {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, path, nil)
		handler.ServeHTTP(rr, req)

		require.Equal(t, exist, rr.Result().Header.Get("Permissions-Policy") != "")
	}

	test("/", true)
	test("/index.html", true)
	test("/api", false)
	test("/an/image.png", false)
}

func TestHTMLAcceptSetsNoCache(t *testing.T) {
	t.Parallel()
	handler := file.NewHandler("", false)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	handler.ServeHTTP(rr, req)

	require.Equal(t, "no-cache, no-store, must-revalidate", rr.Header().Get("Cache-Control"))
}
