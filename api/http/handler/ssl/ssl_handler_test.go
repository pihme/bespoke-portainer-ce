package ssl

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/internal/ssl"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/stretchr/testify/require"
)

func newSSLHandler(t *testing.T) *Handler {
	t.Helper()
	_, store := datastore.MustNewTestStore(t, true, false)
	fileSvc, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)
	svc := ssl.NewService(fileSvc, store, func() {})
	h := NewHandler(testhelpers.NewTestRequestBouncer())
	h.SSLService = svc
	return h
}

func TestSSLInspect(t *testing.T) {
	t.Parallel()
	h := newSSLHandler(t)
	req := httptest.NewRequest(http.MethodGet, "/ssl", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusOK, rr.Code)

	var body map[string]any
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
}

func TestSSLUpdateHTTPEnabled(t *testing.T) {
	t.Parallel()
	h := newSSLHandler(t)
	payload, _ := json.Marshal(map[string]any{"HTTPEnabled": true})
	req := httptest.NewRequest(http.MethodPut, "/ssl", bytes.NewReader(payload))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusNoContent, rr.Code)
}

func TestSSLUpdateValidateRejectsPartialCert(t *testing.T) {
	t.Parallel()
	cert := "cert"
	payload := sslUpdatePayload{Cert: &cert}
	require.Error(t, payload.Validate(nil))

	key := "key"
	payload = sslUpdatePayload{Key: &key}
	require.Error(t, payload.Validate(nil))

	payload = sslUpdatePayload{Cert: &cert, Key: &key}
	require.NoError(t, payload.Validate(nil))

	payload = sslUpdatePayload{}
	require.NoError(t, payload.Validate(nil))
}

func TestSSLUpdateInvalidJSON(t *testing.T) {
	t.Parallel()
	h := newSSLHandler(t)
	req := httptest.NewRequest(http.MethodPut, "/ssl", bytes.NewReader([]byte(`{`)))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestSSLUpdateSetCertificatesInvalid(t *testing.T) {
	t.Parallel()
	h := newSSLHandler(t)
	cert, key := "not-pem", "not-pem"
	payload, _ := json.Marshal(map[string]any{"Cert": cert, "Key": key})
	req := httptest.NewRequest(http.MethodPut, "/ssl", bytes.NewReader(payload))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusInternalServerError, rr.Code)
	_ = context.Background
}
