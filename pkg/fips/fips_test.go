package fips

import (
	"os"
	"os/exec"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInitFIPS(t *testing.T) {
	t.Parallel()
	InitFIPS(false)

	require.False(t, FIPSMode())

	require.True(t, CanTLSSkipVerify())
}

func TestFIPSMode_UninitializedExits(t *testing.T) {
	if os.Getenv("FIPS_FATAL_MODE") == "1" {
		_ = FIPSMode()
		return
	}

	cmd := exec.Command(os.Args[0], "-test.run=TestFIPSMode_UninitializedExits", "-test.v")
	cmd.Env = append(os.Environ(), "FIPS_FATAL_MODE=1")
	err := cmd.Run()
	require.Error(t, err)
}

func TestCanTLSSkipVerify_UninitializedExits(t *testing.T) {
	if os.Getenv("FIPS_FATAL_TLS") == "1" {
		_ = CanTLSSkipVerify()
		return
	}

	cmd := exec.Command(os.Args[0], "-test.run=TestCanTLSSkipVerify_UninitializedExits", "-test.v")
	cmd.Env = append(os.Environ(), "FIPS_FATAL_TLS=1")
	err := cmd.Run()
	require.Error(t, err)
}

func TestInitFIPS_EnabledWithoutGODEBUGExits(t *testing.T) {
	if os.Getenv("FIPS_FATAL_INIT") == "1" {
		InitFIPS(true)
		return
	}

	cmd := exec.Command(os.Args[0], "-test.run=TestInitFIPS_EnabledWithoutGODEBUGExits", "-test.v")
	cmd.Env = append(os.Environ(), "FIPS_FATAL_INIT=1")
	// Ensure fips140 GODEBUG is not set so Fatal triggers when enabled=true
	filtered := make([]string, 0, len(cmd.Env))
	for _, e := range cmd.Env {
		if len(e) >= 8 && e[:8] == "GODEBUG=" {
			continue
		}
		filtered = append(filtered, e)
	}
	cmd.Env = filtered
	err := cmd.Run()
	require.Error(t, err)
}
