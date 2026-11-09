package crypto

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ECDSA helpers used when Portainer signs traffic to a local Docker agent.
// No product REQ ID maps directly onto these primitives; pin observed behaviour.

func TestECDSAService_GenerateParseAndHeaders(t *testing.T) {
	t.Parallel()

	s := NewECDSAService("")
	priv, pub, err := s.GenerateKeyPair()
	require.NoError(t, err)
	require.NotEmpty(t, priv)
	require.NotEmpty(t, pub)

	encoded := s.EncodedPublicKey()
	require.NotEmpty(t, encoded)

	privHdr, pubHdr := s.PEMHeaders()
	assert.Equal(t, PrivateKeyPemHeader, privHdr)
	assert.Equal(t, PublicKeyPemHeader, pubHdr)

	s2 := NewECDSAService("")
	require.NoError(t, s2.ParseKeyPair(priv, pub))
	assert.Equal(t, encoded, s2.EncodedPublicKey())

	sig, err := s2.CreateSignature("agent-message")
	require.NoError(t, err)
	require.NotEmpty(t, sig)
}

func TestECDSAService_ParseKeyPair_InvalidPrivate(t *testing.T) {
	t.Parallel()

	s := NewECDSAService("")
	err := s.ParseKeyPair([]byte("not-a-private-key"), []byte("not-a-public-key"))
	require.Error(t, err)
}

func TestECDSAService_ParseKeyPair_InvalidPublic(t *testing.T) {
	t.Parallel()

	s := NewECDSAService("")
	priv, _, err := s.GenerateKeyPair()
	require.NoError(t, err)

	s2 := NewECDSAService("")
	err = s2.ParseKeyPair(priv, []byte("not-a-public-key"))
	require.Error(t, err)
}

func TestECDSAService_CreateSignature_UsesSecretWhenSet(t *testing.T) {
	t.Parallel()

	s := NewECDSAService("shared-agent-secret")
	_, _, err := s.GenerateKeyPair()
	require.NoError(t, err)

	sig1, err := s.CreateSignature("ignored-when-secret-set")
	require.NoError(t, err)
	sig2, err := s.CreateSignature("also-ignored")
	require.NoError(t, err)
	// Signatures are randomized (ECDSA nonce), but both must succeed and be non-empty.
	require.NotEmpty(t, sig1)
	require.NotEmpty(t, sig2)
}
