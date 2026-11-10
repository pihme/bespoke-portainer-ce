package crypto

import "github.com/portainer/portainer/pkg/fips"

// The FIPS mode used to be initialised by the AES backup tests, which went
// with the backup feature (TAI-006); the kept hash, TLS, ECDSA and nonce
// tests still need it.
func init() {
	fips.InitFIPS(false)
}
