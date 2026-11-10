package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/portainer/portainer/api/http/handler/customtemplates"
	"github.com/portainer/portainer/api/http/handler/docker"
	"github.com/portainer/portainer/api/http/handler/endpointgroups"
	"github.com/portainer/portainer/api/http/handler/endpointproxy"
	"github.com/portainer/portainer/api/http/handler/endpoints"
	"github.com/portainer/portainer/api/http/handler/file"
	"github.com/portainer/portainer/api/http/handler/gitops"
	"github.com/portainer/portainer/api/http/handler/motd"
	"github.com/portainer/portainer/api/http/handler/settings"
	"github.com/portainer/portainer/api/http/handler/ssl"
	"github.com/portainer/portainer/api/http/handler/stacks"
	"github.com/portainer/portainer/api/http/handler/storybook"
	"github.com/portainer/portainer/api/http/handler/system"
	"github.com/portainer/portainer/api/http/handler/tags"
	"github.com/portainer/portainer/api/http/handler/templates"
	"github.com/portainer/portainer/api/http/handler/upload"
	"github.com/portainer/portainer/api/http/handler/websocket"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"
)

func recordingMux(seen *string, code int) *mux.Router {
	r := mux.NewRouter()
	r.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		*seen = req.URL.Path
		w.WriteHeader(code)
	})
	return r
}

func TestServeHTTP_LocalDockerWiring(t *testing.T) {
	var (
		seenCustom, seenDocker, seenGroups, seenEndpoints, seenProxy string
		seenGitops, seenMotd, seenSettings, seenStacks               string
		seenSystem, seenTags, seenTemplates, seenUpload, seenSSL     string
		seenWS, seenStorybook                                        string
	)

	h := &Handler{
		CustomTemplatesHandler: &customtemplates.Handler{Router: recordingMux(&seenCustom, http.StatusOK)},
		DockerHandler:          &docker.Handler{Router: recordingMux(&seenDocker, http.StatusOK)},
		EndpointGroupHandler:   &endpointgroups.Handler{Router: recordingMux(&seenGroups, http.StatusOK)},
		EndpointHandler:        &endpoints.Handler{Router: recordingMux(&seenEndpoints, http.StatusOK)},
		EndpointProxyHandler:   &endpointproxy.Handler{Router: recordingMux(&seenProxy, http.StatusOK)},
		GitOperationHandler:    &gitops.Handler{Router: recordingMux(&seenGitops, http.StatusOK)},
		MOTDHandler:            &motd.Handler{Router: recordingMux(&seenMotd, http.StatusOK)},
		SettingsHandler:        &settings.Handler{Router: recordingMux(&seenSettings, http.StatusOK)},
		StackHandler:           &stacks.Handler{Router: recordingMux(&seenStacks, http.StatusOK)},
		SystemHandler:          &system.Handler{Router: recordingMux(&seenSystem, http.StatusOK)},
		TagHandler:             &tags.Handler{Router: recordingMux(&seenTags, http.StatusOK)},
		TemplatesHandler:       &templates.Handler{Router: recordingMux(&seenTemplates, http.StatusOK)},
		UploadHandler:          &upload.Handler{Router: recordingMux(&seenUpload, http.StatusOK)},
		SSLHandler:             &ssl.Handler{Router: recordingMux(&seenSSL, http.StatusOK)},
		WebSocketHandler:       &websocket.Handler{Router: recordingMux(&seenWS, http.StatusOK)},
		FileHandler:            file.NewHandler(t.TempDir(), false),
		StorybookHandler: &storybook.Handler{Handler: http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			seenStorybook = req.URL.Path
			w.WriteHeader(http.StatusOK)
		})},
	}

	type tc struct {
		path  string
		check func(t *testing.T)
	}
	cases := []tc{
		{"/api/custom_templates", func(t *testing.T) { require.Equal(t, "/custom_templates", seenCustom) }},
		{"/api/docker/containers", func(t *testing.T) { require.Equal(t, "/docker/containers", seenDocker) }},
		{"/api/endpoint_groups", func(t *testing.T) { require.Equal(t, "/endpoint_groups", seenGroups) }},
		{"/api/endpoints", func(t *testing.T) { require.Equal(t, "/endpoints", seenEndpoints) }},
		{"/api/endpoints/1/docker/containers/json", func(t *testing.T) {
			require.Equal(t, "/1/docker/containers/json", seenProxy)
		}},
		{"/api/gitops/sources", func(t *testing.T) { require.Equal(t, "/gitops/sources", seenGitops) }},
		{"/api/motd", func(t *testing.T) { require.Equal(t, "/motd", seenMotd) }},
		{"/api/settings", func(t *testing.T) { require.Equal(t, "/settings", seenSettings) }},
		{"/api/stacks", func(t *testing.T) { require.Equal(t, "/stacks", seenStacks) }},
		{"/api/status", func(t *testing.T) { require.Equal(t, "/status", seenSystem) }},
		{"/api/system/version", func(t *testing.T) { require.Equal(t, "/system/version", seenSystem) }},
		{"/api/tags", func(t *testing.T) { require.Equal(t, "/tags", seenTags) }},
		{"/api/templates", func(t *testing.T) { require.Equal(t, "/templates", seenTemplates) }},
		{"/api/upload/tls/1/ca", func(t *testing.T) { require.Equal(t, "/upload/tls/1/ca", seenUpload) }},
		{"/api/ssl", func(t *testing.T) { require.Equal(t, "/ssl", seenSSL) }},
		{"/api/websocket", func(t *testing.T) { require.Equal(t, "/websocket", seenWS) }},
		{"/storybook/index.html", func(t *testing.T) { require.Equal(t, "/index.html", seenStorybook) }},
		{"/index.html", nil},
	}

	for _, c := range cases {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, c.path, nil)
		require.NotPanics(t, func() { h.ServeHTTP(rec, req) })
		if c.check != nil {
			require.Equal(t, http.StatusOK, rec.Code, c.path)
			c.check(t)
		} else {
			require.NotZero(t, rec.Code, c.path)
		}
	}
}
