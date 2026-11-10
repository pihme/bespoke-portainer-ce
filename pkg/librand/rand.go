package librand

import (
	"crypto/rand"
	"fmt"
	"math/big"
	mrand "math/rand/v2"

	"github.com/portainer/portainer/pkg/fips"
)

func Intn(max int) int {
	return intn(max, fips.FIPSMode())
}

func intn(max int, fips bool) int {
	return int(int64n(int64(max), fips))
}

func int64n(max int64, fips bool) int64 {
	if !fips {
		return mrand.Int64N(max)
	}

	i, err := rand.Int(rand.Reader, big.NewInt(max))
	if err != nil {
		panic(fmt.Sprintf("failed to generate a random number: %v", err))
	}
	if !i.IsInt64() {
		panic("generated random number cannot be represented as an int64")
	}

	return i.Int64()
}
