package git

import (
	"testing"

	gittypes "github.com/portainer/portainer/api/git/types"

	"github.com/stretchr/testify/require"
)

func TestREQ_STK_03_GetCredentials(t *testing.T) {
	t.Parallel()

	t.Run("nil auth returns empty strings", func(t *testing.T) {
		t.Parallel()
		user, pass := GetCredentials(nil)
		require.Empty(t, user)
		require.Empty(t, pass)
	})

	t.Run("returns username and password", func(t *testing.T) {
		t.Parallel()
		user, pass := GetCredentials(&gittypes.GitAuthentication{
			Username: "alice",
			Password: "s3cret",
		})
		require.Equal(t, "alice", user)
		require.Equal(t, "s3cret", pass)
	})
}
