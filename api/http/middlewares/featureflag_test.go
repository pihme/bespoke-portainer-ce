package middlewares

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/portainer/portainer/pkg/featureflags"

	"github.com/stretchr/testify/require"
)

const testFeature featureflags.Feature = "middleware-test-feature"

func resetFeatureFlags(t *testing.T) {
	t.Helper()
	t.Setenv("PORTAINER_FEATURE_FLAGS", "")
	t.Cleanup(func() {
		featureflags.Parse(nil, nil)
	})
}

func TestFeatureFlag_DisabledReturnsForbidden(t *testing.T) {
	resetFeatureFlags(t)
	featureflags.Parse(nil, []featureflags.Feature{testFeature})

	called := false
	handler := FeatureFlag(nil, testFeature)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		called = true
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/feature", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusForbidden, rec.Code)
	require.False(t, called)
	require.Contains(t, rec.Body.String(), "This feature is not enabled")
}

func TestFeatureFlag_EnabledCallsNext(t *testing.T) {
	resetFeatureFlags(t)
	featureflags.Parse([]string{string(testFeature)}, []featureflags.Feature{testFeature})

	called := false
	handler := FeatureFlag(nil, testFeature)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte("ok"))
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/feature", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusAccepted, rec.Code)
	require.True(t, called)
	require.Equal(t, "ok", rec.Body.String())
}

func TestFeatureFlag_UnknownFeatureIsDisabled(t *testing.T) {
	resetFeatureFlags(t)
	featureflags.Parse(nil, nil)

	handler := FeatureFlag(nil, "never-registered")(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("next must not run for an unknown feature")
	}))

	req := httptest.NewRequest(http.MethodPost, "/api/feature", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusForbidden, rec.Code)
}
