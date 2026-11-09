package error

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHandlerErrorConstructors(t *testing.T) {
	t.Parallel()
	underlying := errors.New("boom")

	cases := []struct {
		err  *HandlerError
		code int
		msg  string
	}{
		{BadRequest("bad", underlying), http.StatusBadRequest, "bad"},
		{NotFound("missing", underlying), http.StatusNotFound, "missing"},
		{InternalServerError("oops", underlying), http.StatusInternalServerError, "oops"},
		{Unauthorized("auth", underlying), http.StatusUnauthorized, "auth"},
		{Forbidden("nope", underlying), http.StatusForbidden, "nope"},
		{Conflict("clash", underlying), http.StatusConflict, "clash"},
		{NewError(418, "teapot", underlying), 418, "teapot"},
	}
	for _, tc := range cases {
		require.Equal(t, tc.code, tc.err.StatusCode)
		require.Equal(t, tc.msg, tc.err.Message)
		require.Equal(t, tc.msg, tc.err.Error())
		require.Equal(t, underlying, tc.err.Err)
	}
}

func TestLoggerHandlerWritesJSONError(t *testing.T) {
	t.Parallel()
	h := LoggerHandler(func(w http.ResponseWriter, r *http.Request) *HandlerError {
		return BadRequest("invalid payload", errors.New("detail"))
	})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))
	require.Equal(t, http.StatusBadRequest, rr.Code)
	require.Equal(t, "application/json", rr.Header().Get("Content-Type"))

	var body errorResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
	require.Equal(t, "invalid payload", body.Message)
	require.Equal(t, "Detail", body.Details)
}

func TestLoggerHandlerSuccessNoBody(t *testing.T) {
	t.Parallel()
	h := LoggerHandler(func(w http.ResponseWriter, r *http.Request) *HandlerError {
		w.WriteHeader(http.StatusNoContent)
		return nil
	})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))
	require.Equal(t, http.StatusNoContent, rr.Code)
}

func TestWriteErrorAndCapitalizeNilErr(t *testing.T) {
	t.Parallel()
	rr := httptest.NewRecorder()
	WriteError(rr, http.StatusTeapot, "short circuit", nil)
	require.Equal(t, http.StatusTeapot, rr.Code)

	var body errorResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
	require.Equal(t, "short circuit", body.Message)
	require.Equal(t, "Short circuit", body.Details)

	require.Equal(t, "", capitalize(""))
	require.Equal(t, "A", capitalize("a"))
}

func TestWriteErrorPreservesProvidedErr(t *testing.T) {
	t.Parallel()
	rr := httptest.NewRecorder()
	WriteError(rr, http.StatusBadGateway, "upstream", errors.New("gateway timeout"))
	require.Equal(t, http.StatusBadGateway, rr.Code)

	var body errorResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
	require.Equal(t, "upstream", body.Message)
	require.Equal(t, "Gateway timeout", body.Details)
}
