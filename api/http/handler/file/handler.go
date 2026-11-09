package file

import (
	"net/http"
	"strings"

	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/pkg/featureflags"

	"github.com/klauspost/compress/gzhttp"
)

// Handler represents an HTTP API handler for managing static files.
type Handler struct {
	http.Handler
}

// NewHandler creates a handler to serve static files.
func NewHandler(assetPublicPath string, csp bool) *Handler {
	h := &Handler{
		Handler: security.MWSecureHeaders(
			gzhttp.GzipHandler(http.FileServer(http.Dir(assetPublicPath))),
			featureflags.IsEnabled("hsts"),
			csp,
		),
	}

	return h
}

func isHTML(acceptContent []string) bool {
	for _, accept := range acceptContent {
		if strings.Contains(accept, "text/html") {
			return true
		}
	}

	return false
}

func (handler *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.RequestURI == "/" || strings.HasSuffix(r.RequestURI, ".html") {
		w.Header().Set("Permissions-Policy", strings.Join(permissions, ","))
	}

	if !isHTML(r.Header["Accept"]) {
		w.Header().Set("Cache-Control", "max-age=31536000")
	} else {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	}

	handler.Handler.ServeHTTP(w, r)
}
