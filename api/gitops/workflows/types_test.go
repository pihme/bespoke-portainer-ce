package workflows

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseStatus(t *testing.T) {
	t.Parallel()

	for _, valid := range []string{"healthy", "error", "syncing", "paused", "unknown"} {
		t.Run(valid, func(t *testing.T) {
			t.Parallel()
			s, err := ParseStatus(valid)
			require.NoError(t, err)
			assert.Equal(t, Status(valid), s)
		})
	}

	t.Run("invalid returns error", func(t *testing.T) {
		t.Parallel()
		_, err := ParseStatus("garbage")
		assert.Error(t, err)
	})
}
