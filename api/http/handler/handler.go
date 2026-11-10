package handler

import (
	"net/http"
	"strings"

	"github.com/portainer/portainer/api/http/handler/customtemplates"
	"github.com/portainer/portainer/api/http/handler/docker"
	"github.com/portainer/portainer/api/http/handler/endpointproxy"
	"github.com/portainer/portainer/api/http/handler/endpoints"
	"github.com/portainer/portainer/api/http/handler/file"
	"github.com/portainer/portainer/api/http/handler/gitops"
	"github.com/portainer/portainer/api/http/handler/settings"
	"github.com/portainer/portainer/api/http/handler/ssl"
	"github.com/portainer/portainer/api/http/handler/stacks"
	"github.com/portainer/portainer/api/http/handler/storybook"
	"github.com/portainer/portainer/api/http/handler/system"
	"github.com/portainer/portainer/api/http/handler/templates"
	"github.com/portainer/portainer/api/http/handler/upload"
	"github.com/portainer/portainer/api/http/handler/users"
	"github.com/portainer/portainer/api/http/handler/websocket"
)

// Handler is a collection of all the service handlers.
type Handler struct {
	CustomTemplatesHandler *customtemplates.Handler
	DockerHandler          *docker.Handler
	EndpointHandler        *endpoints.Handler
	EndpointProxyHandler   *endpointproxy.Handler
	GitOperationHandler    *gitops.Handler
	FileHandler            *file.Handler
	SettingsHandler        *settings.Handler
	SSLHandler             *ssl.Handler
	StackHandler           *stacks.Handler
	StorybookHandler       *storybook.Handler
	SystemHandler          *system.Handler
	TemplatesHandler       *templates.Handler
	UploadHandler          *upload.Handler
	UserHandler            *users.Handler
	WebSocketHandler       *websocket.Handler
}

// @title PortainerCE API
// @version 2.45.3
// @description.markdown
// @x-tagGroups [{"name":"Local operator","tags":["users"]},{"name":"Administration","tags":["settings","status","system","ssl","upload"]},{"name":"Docker","tags":["templates","custom_templates","docker","stacks","websocket"]},{"name":"Environment Management","tags":["endpoints"]},{"name":"GitOps","tags":["gitops"]}]
// @termsOfService

// @contact.email info@portainer.io

// @license.name zlib
// @license.url https://github.com/portainer/portainer/blob/develop/LICENSE

// @host
// @BasePath /api
// @schemes http https

// @tag.name custom_templates
// @tag.description Manage Custom Templates
// @tag.x-displayName Custom templates
// @tag.name docker
// @tag.description Manage Docker resources
// @tag.x-displayName Docker resources
// @tag.name endpoints
// @tag.description Manage environments
// @tag.x-displayName Environments
// @tag.name gitops
// @tag.description Operate git repository
// @tag.x-displayName GitOps
// @tag.name settings
// @tag.description Manage Portainer settings
// @tag.x-displayName Portainer settings
// @tag.name ssl
// @tag.description Manage ssl settings
// @tag.x-displayName SSL
// @tag.name stacks
// @tag.description Manage stacks
// @tag.x-displayName Stacks
// @tag.name status
// @tag.description Information about the Portainer instance
// @tag.x-displayName Portainer status
// @tag.name system
// @tag.description Manage Portainer system
// @tag.x-displayName Portainer system
// @tag.name templates
// @tag.description Manage App Templates
// @tag.x-displayName App templates
// @tag.name upload
// @tag.description Upload files
// @tag.x-displayName Upload files
// @tag.name users
// @tag.description Local operator UI preferences
// @tag.x-displayName Local operator
// @tag.name websocket
// @tag.description Create exec sessions using websockets
// @tag.x-displayName Websocket

// ServeHTTP delegates a request to the appropriate subhandler.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch {
	case strings.HasPrefix(r.URL.Path, "/api/custom_templates"):
		http.StripPrefix("/api", h.CustomTemplatesHandler).ServeHTTP(w, r)
	case strings.HasPrefix(r.URL.Path, "/api/docker"):
		http.StripPrefix("/api", h.DockerHandler).ServeHTTP(w, r)

	case strings.HasPrefix(r.URL.Path, "/api/endpoints"):
		switch {
		case strings.Contains(r.URL.Path, "/docker/"):
			http.StripPrefix("/api/endpoints", h.EndpointProxyHandler).ServeHTTP(w, r)
		case strings.Contains(r.URL.Path, "/agent/"):
			http.StripPrefix("/api/endpoints", h.EndpointProxyHandler).ServeHTTP(w, r)
		default:
			http.StripPrefix("/api", h.EndpointHandler).ServeHTTP(w, r)
		}
	case strings.HasPrefix(r.URL.Path, "/api/gitops"):
		http.StripPrefix("/api", h.GitOperationHandler).ServeHTTP(w, r)
	case strings.HasPrefix(r.URL.Path, "/api/settings"):
		http.StripPrefix("/api", h.SettingsHandler).ServeHTTP(w, r)
	case strings.HasPrefix(r.URL.Path, "/api/stacks"):
		http.StripPrefix("/api", h.StackHandler).ServeHTTP(w, r)
	case strings.HasPrefix(r.URL.Path, "/api/status"):
		http.StripPrefix("/api", h.SystemHandler).ServeHTTP(w, r)
	case strings.HasPrefix(r.URL.Path, "/api/system"):
		http.StripPrefix("/api", h.SystemHandler).ServeHTTP(w, r)
	case strings.HasPrefix(r.URL.Path, "/api/templates"):
		http.StripPrefix("/api", h.TemplatesHandler).ServeHTTP(w, r)
	case strings.HasPrefix(r.URL.Path, "/api/upload"):
		http.StripPrefix("/api", h.UploadHandler).ServeHTTP(w, r)
	case strings.HasPrefix(r.URL.Path, "/api/users"):
		http.StripPrefix("/api", h.UserHandler).ServeHTTP(w, r)
	case strings.HasPrefix(r.URL.Path, "/api/ssl"):
		http.StripPrefix("/api", h.SSLHandler).ServeHTTP(w, r)
	case strings.HasPrefix(r.URL.Path, "/api/websocket"):
		http.StripPrefix("/api", h.WebSocketHandler).ServeHTTP(w, r)
	case strings.HasPrefix(r.URL.Path, "/storybook"):
		http.StripPrefix("/storybook", h.StorybookHandler).ServeHTTP(w, r)
	case strings.HasPrefix(r.URL.Path, "/"):
		h.FileHandler.ServeHTTP(w, r)
	}
}
