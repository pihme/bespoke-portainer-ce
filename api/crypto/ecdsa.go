package crypto

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/hex"
)

const (
	// PrivateKeyPemHeader represents the header that is appended to the PEM file when
	// storing the private key.
	PrivateKeyPemHeader = "EC PRIVATE KEY"
	// PublicKeyPemHeader represents the header that is appended to the PEM file when
	// storing the public key.
	PublicKeyPemHeader = "ECDSA PUBLIC KEY"
)

// ECDSAService is a service used to create digital signatures when communicating with
// an agent based environment(endpoint). It will automatically generates a key pair using ECDSA or
// can also reuse an existing ECDSA key pair.
type ECDSAService struct {
	privateKey    *ecdsa.PrivateKey
	publicKey     *ecdsa.PublicKey
	encodedPubKey string
	secret        string
}

// NewECDSAService returns a pointer to a ECDSAService.
// An optional secret can be specified
func NewECDSAService(secret string) *ECDSAService {
	return &ECDSAService{
		secret: secret,
	}
}

// PEMHeaders returns the ECDSA PEM headers.
func (service *ECDSAService) PEMHeaders() (string, string) {
	return PrivateKeyPemHeader, PublicKeyPemHeader
}

// ParseKeyPair parses existing private/public key pair content and associate
// the parsed keys to the service.
func (service *ECDSAService) ParseKeyPair(private, public []byte) error {
	privateKey, err := x509.ParseECPrivateKey(private)
	if err != nil {
		return err
	}

	service.privateKey = privateKey

	encodedKey := hex.EncodeToString(public)
	service.encodedPubKey = encodedKey

	publicKey, err := x509.ParsePKIXPublicKey(public)
	if err != nil {
		return err
	}

	service.publicKey = publicKey.(*ecdsa.PublicKey)

	return nil
}

// GenerateKeyPair will create a new key pair using ECDSA.
func (service *ECDSAService) GenerateKeyPair() ([]byte, []byte, error) {
	pubkeyCurve := elliptic.P256()

	privatekey, err := ecdsa.GenerateKey(pubkeyCurve, rand.Reader)
	if err != nil {
		return nil, nil, err
	}

	service.privateKey = privatekey
	service.publicKey = &privatekey.PublicKey

	private, err := x509.MarshalECPrivateKey(service.privateKey)
	if err != nil {
		return nil, nil, err
	}

	public, err := x509.MarshalPKIXPublicKey(service.publicKey)
	if err != nil {
		return nil, nil, err
	}

	encodedKey := hex.EncodeToString(public)
	service.encodedPubKey = encodedKey

	return private, public, nil
}
