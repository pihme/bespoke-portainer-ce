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
