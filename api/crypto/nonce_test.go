package crypto

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewRandomNonce_RejectsTooSmall(t *testing.T) {
	t.Parallel()

	_, err := NewRandomNonce(1)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "greater than")

	_, err = NewRandomNonce(0)
	require.Error(t, err)
}

func TestNewRandomNonce_CreatesUsableNonce(t *testing.T) {
	t.Parallel()

	n, err := NewRandomNonce(12)
	require.NoError(t, err)
	require.Len(t, n.Value(), 12)
	// First byte is random; remaining bytes start at zero.
	assert.Equal(t, make([]byte, 11), n.Value()[1:])
}

func TestNonce_ReadAndIncrement(t *testing.T) {
	t.Parallel()

	n := NewNonce(4)
	require.NoError(t, n.Read(bytes.NewReader([]byte{0, 0, 0, 1})))
	assert.Equal(t, []byte{0, 0, 0, 1}, n.Value())

	require.NoError(t, n.Increment())
	assert.Equal(t, []byte{0, 0, 0, 2}, n.Value())
}

func TestNonce_IncrementOverflow(t *testing.T) {
	t.Parallel()

	n := NewNonce(2)
	require.NoError(t, n.Read(bytes.NewReader([]byte{0xff, 0xff})))
	err := n.Increment()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "overflow")
}
