package middlewares

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

func saveGlobalLevel(t *testing.T) {
	t.Helper()
	orig := zerolog.GlobalLevel()
	t.Cleanup(func() { zerolog.SetGlobalLevel(orig) })
}

func TestWithSlowRequestsLogger_PassthroughWhenNotDebug(t *testing.T) {
	saveGlobalLevel(t)
	zerolog.SetGlobalLevel(zerolog.InfoLevel)
	buf := setupLogOutput(t)

	called := false
	handler := WithSlowRequestsLogger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		// Would trigger a slow-request log if the wrapper were installed.
		time.Sleep(110 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/x", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	require.True(t, called)
	require.Equal(t, http.StatusOK, rec.Code)
	require.NotContains(t, buf.String(), "slow request",
		"above Debug the middleware must return next unchanged, so no slow-request log")
}

func TestWithSlowRequestsLogger_FastRequestNoLog(t *testing.T) {
	saveGlobalLevel(t)
	zerolog.SetGlobalLevel(zerolog.DebugLevel)
	buf := setupLogOutput(t)

	called := false
	handler := WithSlowRequestsLogger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/fast", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	require.True(t, called)
	require.Equal(t, http.StatusNoContent, rec.Code)
	require.NotContains(t, buf.String(), "slow request")
}

func TestWithSlowRequestsLogger_SlowRequestLogs(t *testing.T) {
	saveGlobalLevel(t)
	zerolog.SetGlobalLevel(zerolog.DebugLevel)
	buf := setupLogOutput(t)

	handler := WithSlowRequestsLogger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(110 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/slow?x=1", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	out := buf.String()
	require.Contains(t, out, "slow request")
	require.Contains(t, out, "GET")
	require.Contains(t, out, "/api/slow?x=1")
}
