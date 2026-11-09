package http

import (
	"bytes"
	"testing"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/stretchr/testify/require"
)

// TestLogger replaces the global log.Logger, so it must not run in parallel
// with other tests that log, and it restores the original logger afterwards.
func TestLogger(t *testing.T) {
	msg := "Testing HTTP logger"
	buf := &bytes.Buffer{}

	oldLogger := log.Logger
	log.Logger = zerolog.New(buf)
	t.Cleanup(func() {
		log.Logger = oldLogger
	})

	NewHTTPLogger().Print(msg)

	require.Contains(t, buf.String(), msg)
}
