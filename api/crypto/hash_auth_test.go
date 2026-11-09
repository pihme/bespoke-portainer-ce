package crypto

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// Password hashing used by internal-auth login / password checks (REQ-AUTH-03).

func TestREQ_AUTH_03_HashRoundTrip(t *testing.T) {
	t.Parallel()

	s := Service{}
	password := "Passw0rd!local"

	hash, err := s.Hash(password)
	require.NoError(t, err)
	require.NotEmpty(t, hash)
	require.True(t, strings.HasPrefix(hash, "$2"), "bcrypt hash prefix")

	require.NoError(t, s.CompareHashAndData(hash, password))
	require.Error(t, s.CompareHashAndData(hash, "wrong-password"))
}

func TestREQ_AUTH_03_HashRejectsOversizedPassword(t *testing.T) {
	t.Parallel()

	s := Service{}
	_, err := s.Hash(strings.Repeat("a", 73))
	require.Error(t, err)
}
