package testhelpers

import (
	"errors"

	portainer "github.com/portainer/portainer/api"
)

// Fixed values the stub signature service signs with, so tests can assert which
// header carries what.
const (
	StubSignature = "mocked-signature"
	StubPublicKey = "mocked-public-key"
)

// ErrSignatureFailure is what the failing signature service returns.
var ErrSignatureFailure = errors.New("signature failure")

type stubSignatureService struct {
	portainer.DigitalSignatureService
}

// NewStubSignatureService returns a signature service that signs with fixed,
// recognisable values.
func NewStubSignatureService() *stubSignatureService {
	return &stubSignatureService{}
}

func (s *stubSignatureService) CreateSignature(message string) (string, error) {
	return StubSignature, nil
}

func (s *stubSignatureService) EncodedPublicKey() string {
	return StubPublicKey
}

type failingSignatureService struct {
	portainer.DigitalSignatureService
}

// NewFailingSignatureService returns a signature service whose CreateSignature
// always fails, so tests can tell whether the signature was computed at all.
func NewFailingSignatureService() *failingSignatureService {
	return &failingSignatureService{}
}

func (s *failingSignatureService) CreateSignature(message string) (string, error) {
	return "", ErrSignatureFailure
}
