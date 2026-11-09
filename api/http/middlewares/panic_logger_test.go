package middlewares

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/stretchr/testify/require"
)

// These tests replace the global log.Logger, so they must not run in parallel
// with other tests that log, and they restore the original logger afterwards.
func setupLogOutput(t *testing.T) *bytes.Buffer {
	t.Helper()

	buf := &bytes.Buffer{}
	oldLogger := log.Logger
	log.Logger = zerolog.New(buf)
	t.Cleanup(func() {
		log.Logger = oldLogger
	})

	return buf
}

func TestWithPanicLoggerRecoversAndLogsRegularPanic(t *testing.T) {
	buf := setupLogOutput(t)

	handler := WithPanicLogger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("boom")
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Contains(t, buf.String(), "Panic in request handler")
	require.Contains(t, buf.String(), "boom")
}

func TestWithPanicLoggerRePanicsErrAbortHandler(t *testing.T) {
	buf := setupLogOutput(t)

	handler := WithPanicLogger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic(http.ErrAbortHandler)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	rec := httptest.NewRecorder()

	var recovered any
	func() {
		defer func() {
			recovered = recover()
		}()

		handler.ServeHTTP(rec, req)
	}()

	require.Equal(t, http.ErrAbortHandler, recovered)
	require.Empty(t, buf.String())
}

func TestWithPanicLoggerPassesThroughWithoutPanic(t *testing.T) {
	buf := setupLogOutput(t)

	handler := WithPanicLogger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte("ok"))
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/ok", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	require.Equal(t, "ok", rec.Body.String())
	require.Empty(t, buf.String())
}
