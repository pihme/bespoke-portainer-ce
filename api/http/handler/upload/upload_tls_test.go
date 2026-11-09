package upload

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/require"
)

func newUploadHandler(t *testing.T) *Handler {
	t.Helper()
	fileSvc, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	h := NewHandler(testhelpers.NewTestRequestBouncer())
	h.FileService = fileSvc
	return h
}

func multipartTLS(t *testing.T, folder, content string) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	require.NoError(t, w.WriteField("folder", folder))
	part, err := w.CreateFormFile("file", "tls.pem")
	require.NoError(t, err)
	_, err = part.Write([]byte(content))
	require.NoError(t, err)
	require.NoError(t, w.Close())
	return body, w.FormDataContentType()
}

func TestNewHandlerRegistersTLSUploadRoute(t *testing.T) {
	t.Parallel()
	h := newUploadHandler(t)
	require.NotNil(t, h.Router)
}

func TestUploadTLS_StoresCACertAndKey(t *testing.T) {
	t.Parallel()
	h := newUploadHandler(t)

	for _, certType := range []string{"ca", "cert", "key"} {
		body, ctype := multipartTLS(t, "endpoint-1", certType+"-bytes")
		req := httptest.NewRequest(http.MethodPost, "/upload/tls/"+certType, body)
		req.Header.Set("Content-Type", ctype)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		require.Equalf(t, http.StatusNoContent, rr.Code, "type=%s body=%s", certType, rr.Body.String())
	}
}

func TestUploadTLS_MissingFolder(t *testing.T) {
	t.Parallel()
	h := newUploadHandler(t)
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	part, err := w.CreateFormFile("file", "tls.pem")
	require.NoError(t, err)
	_, _ = part.Write([]byte("x"))
	require.NoError(t, w.Close())

	req := httptest.NewRequest(http.MethodPost, "/upload/tls/ca", body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestUploadTLS_MissingFile(t *testing.T) {
	t.Parallel()
	h := newUploadHandler(t)
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	require.NoError(t, w.WriteField("folder", "endpoint-1"))
	require.NoError(t, w.Close())

	req := httptest.NewRequest(http.MethodPost, "/upload/tls/cert", body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestUploadTLS_InvalidCertificateTypeRejectedByRoute(t *testing.T) {
	t.Parallel()
	h := newUploadHandler(t)
	body, ctype := multipartTLS(t, "endpoint-1", "x")
	req := httptest.NewRequest(http.MethodPost, "/upload/tls/other", body)
	req.Header.Set("Content-Type", ctype)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusNotFound, rr.Code)
}
