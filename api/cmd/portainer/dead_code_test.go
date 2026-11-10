package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// repoRoot is the repository root seen from api/cmd/portainer.
const repoRoot = "../../.."

// TestREQ_TAI_015_OrphanPackagesAreGone proves that the Go packages nothing
// imported after TAI-001 to TAI-014 are deleted.
func TestREQ_TAI_015_OrphanPackagesAreGone(t *testing.T) {
	for _, dir := range []string{
		"pkg/liboras",
		"pkg/registryhttp",
		"api/http/proxy/factory/github",
		"api/http/proxy/factory/gitlab",
		"pkg/libkompose",
		"pkg/libpolicy",
		"pkg/libprometheus",
		"pkg/metrics",
		"pkg/retry",
		"api/kubernetes/privateregistries",
		"api/kubernetes/validation",
		"api/internal/edge/types",
	} {
		_, err := os.Stat(filepath.Join(repoRoot, dir))
		require.Truef(t, os.IsNotExist(err), "%s should be removed", dir)
	}
}

// TestREQ_TAI_015_UnusedModulesAreGone proves that go.mod and package.json no
// longer list the modules only the removed code used.
func TestREQ_TAI_015_UnusedModulesAreGone(t *testing.T) {
	goMod, err := os.ReadFile(filepath.Join(repoRoot, "go.mod"))
	require.NoError(t, err)

	for _, module := range []string{
		"github.com/go-ldap/ldap/v3",
		"helm.sh/helm/v4",
		"oras.land/oras-go/v2",
		"github.com/kubernetes/kompose",
		"github.com/prometheus/prometheus",
		"github.com/koding/websocketproxy",
		"github.com/g07cha/defender",
		"github.com/samber/slog-zerolog/v2",
		"github.com/viney-shih/go-lock",
		"github.com/cbroglie/mustache",
	} {
		require.NotContainsf(t, string(goMod), module+" ", "go.mod should not list %s", module)
	}

	raw, err := os.ReadFile(filepath.Join(repoRoot, "package.json"))
	require.NoError(t, err)

	var pkg struct {
		Dependencies    map[string]string `json:"dependencies"`
		DevDependencies map[string]string `json:"devDependencies"`
	}
	require.NoError(t, json.Unmarshal(raw, &pkg))

	for _, name := range []string{
		"@aws-crypto/sha256-js",
		"@wojtekmaj/react-daterange-picker",
		"chardet",
		"fast-json-patch",
		"filesize-parser",
		"@types/filesize-parser",
		"js-base64",
		"strip-ansi",
		"kubernetes-types",
	} {
		_, dep := pkg.Dependencies[name]
		_, dev := pkg.DevDependencies[name]
		require.Falsef(t, dep || dev, "package.json should not list %s", name)
	}

	require.False(t, strings.Contains(string(goMod), "oras.land"), "no oras module should stay")
}

// TestREQ_TAI_016_UnreachableKubernetesStackIsGone proves that the Kubernetes
// proxy, the kubeconfig JWT service, the Kubernetes deployer, libkubectl, the
// namespace cleanup and the Kubernetes-only pending-action handlers are
// deleted, while the Kubernetes client the post-init migration and the
// snapshots of leftover records use stays.
func TestREQ_TAI_016_UnreachableKubernetesStackIsGone(t *testing.T) {
	for _, path := range []string{
		"api/http/proxy/factory/kubernetes",
		"api/http/proxy/factory/kubernetes.go",
		"api/jwt",
		"api/exec/kubernetes_deploy.go",
		"api/exec/exectest",
		"pkg/libkubectl",
		"api/kubernetes/namespacecleanup",
		"api/pendingactions/handlers/cleanup_namespace_records.go",
		"api/pendingactions/handlers/delete_k8s_registry_secrets.go",
		// The rest of the pending-action service went with its collection (TAI-023).
		"api/pendingactions",
	} {
		_, err := os.Stat(filepath.Join(repoRoot, path))
		require.Truef(t, os.IsNotExist(err), "%s should be removed", path)
	}

	for _, path := range []string{
		"api/kubernetes/cli",
		"api/datastore/postinit/migrate_post_init.go",
	} {
		_, err := os.Stat(filepath.Join(repoRoot, path))
		require.NoErrorf(t, err, "%s should stay", path)
	}

	goMod, err := os.ReadFile(filepath.Join(repoRoot, "go.mod"))
	require.NoError(t, err)

	for _, module := range []string{"k8s.io/kubectl", "k8s.io/cli-runtime"} {
		require.NotContainsf(t, string(goMod), module+" ", "go.mod should not list %s", module)
	}
}

// TestREQ_TAI_017_DeadEdgeHelpersAreGone proves that the Edge relation helpers
// no kept path called are deleted. The Edge group match that TAI-017 kept for
// the environment list search went with the Edge group collection (TAI-021).
func TestREQ_TAI_017_DeadEdgeHelpersAreGone(t *testing.T) {
	for _, path := range []string{
		"api/http/handler/endpoints/update_edge_relations.go",
		"api/internal/edge/edgestack.go",
		"api/internal/edge/endpoint.go",
		"api/internal/edge/edgegroup.go",
	} {
		_, err := os.Stat(filepath.Join(repoRoot, path))
		require.Truef(t, os.IsNotExist(err), "%s should be removed", path)
	}
}

// swaggerPaths returns the route paths listed in api/docs/swagger.yaml.
func swaggerPaths(t *testing.T) []string {
	t.Helper()

	raw, err := os.ReadFile(filepath.Join(repoRoot, "api/docs/swagger.yaml"))
	require.NoError(t, err)

	var paths []string
	inPaths := false
	for line := range strings.SplitSeq(string(raw), "\n") {
		if line == "paths:" {
			inPaths = true

			continue
		}
		if inPaths && line != "" && !strings.HasPrefix(line, " ") {
			break
		}
		if inPaths && strings.HasPrefix(line, "  /") {
			paths = append(paths, strings.TrimSuffix(strings.TrimSpace(line), ":"))
		}
	}

	return paths
}

// TestREQ_TAI_019_ApiDocsListNoRemovedRoutes proves that the regenerated
// Swagger document and the generated client no longer describe the routes
// TAI-001 to TAI-014 removed, while the kept routes are still described.
func TestREQ_TAI_019_ApiDocsListNoRemovedRoutes(t *testing.T) {
	paths := swaggerPaths(t)
	require.NotEmpty(t, paths)

	removed := []string{
		"/auth", "/backup", "/restore", "/edge_", "/endpoint_groups", "/kubernetes",
		"/registries", "/tags", "/teams", "/team_memberships", "/roles", "/webhooks",
		"/gitops/workflows", "/licenses", "/motd", "/helm", "/endpoints/relations",
		"/endpoints/global-key", "/endpoints/{id}/kubernetes", "/endpoints/{id}/edge",
		"/endpoints/{id}/registries", "/endpoints/{id}/dockerhub", "/users/{id}/tokens",
	}
	for _, p := range paths {
		for _, prefix := range removed {
			require.Falsef(t, strings.HasPrefix(p, prefix), "swagger still lists removed route %s", p)
		}
	}

	for _, kept := range []string{
		"/stacks", "/stacks/webhooks/{webhookID}", "/stacks/{id}/git/redeploy",
		"/custom_templates", "/gitops/sources", "/endpoints", "/settings", "/system/version",
	} {
		require.Containsf(t, paths, kept, "swagger should still list %s", kept)
	}

	sdk, err := os.ReadFile(filepath.Join(repoRoot, "app/react/portainer/generated-api/portainer/sdk.gen.ts"))
	require.NoError(t, err)
	for _, url := range []string{"'/kubernetes/", "'/edge_stacks", "'/edge_groups", "'/endpoint_groups", "'/registries", "'/tags", "'/teams", "'/auth", "'/gitops/workflows"} {
		require.NotContainsf(t, string(sdk), "url: "+url, "generated client still calls %s", url)
	}
}
