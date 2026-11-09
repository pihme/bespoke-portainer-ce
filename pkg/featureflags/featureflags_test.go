package featureflags

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// saveFeatureFlags restores the package-level featureFlags map after the test.
func saveFeatureFlags(t *testing.T) {
	t.Helper()

	orig := featureFlags
	t.Cleanup(func() { featureFlags = orig })
}

func Test_enableFeaturesFromFlags(t *testing.T) {
	saveFeatureFlags(t)

	is := assert.New(t)

	supportedFeatures := []Feature{"supported", "supported2", "supported3", "supported4", "supported5"}

	t.Run("supported features should be supported", func(t *testing.T) {
		initSupportedFeatures(supportedFeatures)

		for _, featureFlag := range supportedFeatures {
			is.True(IsSupported(featureFlag))
		}
	})

	t.Run("unsupported features should not be supported", func(t *testing.T) {
		initSupportedFeatures(supportedFeatures)

		is.False(IsSupported("unsupported"))
	})

	tests := []struct {
		cliFeatureFlags []string
		envFeatureFlags []string
	}{
		{[]string{"supported", "supported2"}, []string{"supported3", "supported4"}},
	}

	for _, test := range tests {
		t.Setenv("PORTAINER_FEATURE_FLAGS", strings.Join(test.envFeatureFlags, ","))

		t.Run("testing", func(t *testing.T) {
			Parse(test.cliFeatureFlags, supportedFeatures)
			supported := toFeatureMap(test.cliFeatureFlags, test.envFeatureFlags)

			// add env flags to supported flags
			for _, featureFlag := range test.envFeatureFlags {
				supported[Feature(featureFlag)] = true
			}

			for _, featureFlag := range supportedFeatures {
				if _, ok := supported[featureFlag]; ok {
					is.True(IsEnabled(featureFlag))
				} else {
					is.False(IsEnabled(featureFlag))
				}
			}
		})
	}
}

// helper
func toFeatureMap(cliFeatures []string, envFeatures []string) map[Feature]bool {
	m := map[Feature]bool{}
	for _, s := range cliFeatures {
		m[Feature(s)] = true
	}

	for _, s := range envFeatures {
		m[Feature(s)] = true
	}

	return m
}
