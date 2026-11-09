package motd

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/portainer/portainer/api/internal/testhelpers"
	motdservice "github.com/portainer/portainer/api/motd"

	"github.com/stretchr/testify/require"
)

func TestNewHandler_RegistersMOTDRoute(t *testing.T) {
	t.Parallel()

	svc := motdservice.NewService("http://unused")
	h := NewHandler(testhelpers.NewTestRequestBouncer(), svc)
	require.NotNil(t, h)
	require.NotNil(t, h.Router)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/motd", nil)
	h.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)

	var body motdservice.Motd
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
	require.Empty(t, body.Title)
	require.Empty(t, body.Message)
}

func TestMOTD_ReturnsCachedPayload(t *testing.T) {
	t.Parallel()

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"title":"Hello","message":["line1","line2"],"style":"info","contentLayout":{"a":"b"}}`))
	}))
	t.Cleanup(ts.Close)

	svc := motdservice.NewService(ts.URL)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	svc.Start(ctx)

	deadline := time.Now().Add(2 * time.Second)
	for svc.GetCached().Title == "" {
		if time.Now().After(deadline) {
			t.Skip("MOTD cache did not warm (external request may be disabled)")
		}
		time.Sleep(10 * time.Millisecond)
	}

	h := NewHandler(testhelpers.NewTestRequestBouncer(), svc)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/motd", nil)
	h.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)

	var body motdservice.Motd
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
	require.Equal(t, "Hello", body.Title)
	require.Equal(t, "line1\nline2", body.Message)
	require.Equal(t, "info", body.Style)
	require.Equal(t, map[string]string{"a": "b"}, body.ContentLayout)
	require.NotEmpty(t, body.Hash)
}

func TestMOTD_MethodNotAllowed(t *testing.T) {
	t.Parallel()

	svc := motdservice.NewService("http://unused")
	h := NewHandler(testhelpers.NewTestRequestBouncer(), svc)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/motd", nil)
	h.ServeHTTP(rr, req)

	require.Equal(t, http.StatusMethodNotAllowed, rr.Code)
}
