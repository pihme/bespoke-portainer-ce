package motd

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	libclient "github.com/portainer/portainer/pkg/libhttp/client"
	"github.com/portainer/portainer/pkg/featureflags"

	"github.com/stretchr/testify/require"
)

func TestStart_ExternalRequestsDisabled(t *testing.T) {
	// Not parallel: mutates global feature flags.
	orig := featureflags.FeatureFlags()
	t.Cleanup(func() {
		featureflags.Parse(nil, nil)
		_ = orig
	})
	featureflags.Parse([]string{libclient.DisableExternalRequests}, []featureflags.Feature{libclient.DisableExternalRequests})

	svc := NewService("https://motd.example.com")
	svc.Start(t.Context())
	// Start returns immediately when external requests are blocked.
	require.Equal(t, Motd{}, svc.GetCached())
}

func TestStart_SchedulesRefresh(t *testing.T) {
	t.Parallel()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"title":"Live","message":["hi"],"style":"info"}`))
	}))
	t.Cleanup(ts.Close)

	ctx, cancel := context.WithCancel(t.Context())
	t.Cleanup(cancel)

	svc := NewService(ts.URL)
	svc.Start(ctx)

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if svc.GetCached().Title == "Live" {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	require.Equal(t, "Live", svc.GetCached().Title)
	require.Equal(t, "hi", svc.GetCached().Message)
	require.Equal(t, "info", svc.GetCached().Style)
}

func TestRefresh_ExternalRequestsDisabledClearsCache(t *testing.T) {
	// Not parallel: mutates global feature flags.
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"title":"Cached","message":["x"]}`))
	}))
	t.Cleanup(ts.Close)

	svc := NewService(ts.URL)
	svc.refresh()
	require.Equal(t, "Cached", svc.GetCached().Title)

	featureflags.Parse([]string{libclient.DisableExternalRequests}, []featureflags.Feature{libclient.DisableExternalRequests})
	t.Cleanup(func() { featureflags.Parse(nil, nil) })

	svc.refresh()
	require.Equal(t, Motd{}, svc.GetCached())
}
