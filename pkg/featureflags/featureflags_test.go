package featureflags

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// saveFeatureFlags restores the package-level featureFlags map after the test.
func saveFeatureFlags(t *testing.T) {
	t.Helper()

	orig := featureFlags
	t.Cleanup(func() { featureFlags = orig })
}

func TestFeatureFlags_ReturnsMap(t *testing.T) {
	saveFeatureFlags(t)

	Parse([]string{"alpha"}, []Feature{"alpha", "beta"})
	flags := FeatureFlags()
	assert.True(t, flags["alpha"])
	assert.False(t, flags["beta"])
}
