package crypto

import (
	"bytes"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Small-input coverage for the public AES helpers used by password-protected
// backup/restore (REQ-BKP-01 / REQ-BKP-02). The large-file cases live in the
// performance-tagged suite and are outside the reference set.

func TestREQ_BKP_01_AesEncryptDecrypt_SmallRoundTrip(t *testing.T) {
	t.Parallel()

	passphrase := []byte("backup-passphrase")
	plain := []byte("portainer backup payload — small reference-set input")

	var encrypted bytes.Buffer
	err := AesEncrypt(bytes.NewReader(plain), &encrypted, passphrase)
	require.NoError(t, err)
	require.NotEmpty(t, encrypted.Bytes())
	assert.NotEqual(t, plain, encrypted.Bytes())
	assert.True(t, HasEncryptedHeader(encrypted.Bytes()), "non-FIPS encrypt should write AES256-GCM header")

	reader, err := AesDecrypt(bytes.NewReader(encrypted.Bytes()), passphrase)
	require.NoError(t, err)
	got, err := io.ReadAll(reader)
	require.NoError(t, err)
	assert.Equal(t, plain, got)
}

func TestREQ_BKP_01_AesEncryptDecrypt_EmptyPlaintext(t *testing.T) {
	t.Parallel()

	passphrase := []byte("empty")
	var encrypted bytes.Buffer
	err := AesEncrypt(bytes.NewReader(nil), &encrypted, passphrase)
	require.NoError(t, err)
	// Header + salt + nonce are still written for an empty body.
	assert.True(t, HasEncryptedHeader(encrypted.Bytes()))

	reader, err := AesDecrypt(bytes.NewReader(encrypted.Bytes()), passphrase)
	require.NoError(t, err)
	got, err := io.ReadAll(reader)
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestREQ_BKP_01_AesDecrypt_WrongPassphrase(t *testing.T) {
	t.Parallel()

	var encrypted bytes.Buffer
	require.NoError(t, AesEncrypt(bytes.NewReader([]byte("secret data")), &encrypted, []byte("correct")))

	_, err := AesDecrypt(bytes.NewReader(encrypted.Bytes()), []byte("wrong"))
	require.Error(t, err)
}

func TestREQ_BKP_01_AesDecrypt_HeaderTooShort(t *testing.T) {
	t.Parallel()

	_, err := AesDecrypt(bytes.NewReader([]byte("short")), []byte("pass"))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "header")
}

func TestREQ_BKP_01_HasEncryptedHeader_Public(t *testing.T) {
	t.Parallel()

	assert.True(t, HasEncryptedHeader([]byte("AES256-GCM"+strings.Repeat("x", 8))))
	assert.False(t, HasEncryptedHeader([]byte("FIPS-AES256-GCM"+strings.Repeat("x", 8))))
	assert.False(t, HasEncryptedHeader([]byte("not-encrypted")))
	assert.False(t, HasEncryptedHeader(nil))
}

func TestREQ_BKP_01_AesDecrypt_FIPSHeaderRejectedWhenFIPSDisabled(t *testing.T) {
	t.Parallel()

	var encrypted bytes.Buffer
	require.NoError(t, aesEncryptGCMFIPS(bytes.NewReader([]byte("fips body")), &encrypted, []byte("pass")))

	_, err := aesDecrypt(bytes.NewReader(encrypted.Bytes()), []byte("pass"), false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "fips")
}

func TestREQ_BKP_01_AesDecrypt_NonFIPSHeaderRejectedWhenFIPSEnabled(t *testing.T) {
	t.Parallel()

	var encrypted bytes.Buffer
	require.NoError(t, aesEncryptGCM(bytes.NewReader([]byte("gcm body")), &encrypted, []byte("pass")))

	_, err := aesDecrypt(bytes.NewReader(encrypted.Bytes()), []byte("pass"), true)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "fips mode is enabled")
}

func TestREQ_BKP_01_AesDecrypt_FIPSHeaderAcceptedInFIPSMode(t *testing.T) {
	t.Parallel()

	plain := []byte("fips-mode decrypt via aesDecrypt")
	var encrypted bytes.Buffer
	require.NoError(t, aesEncryptGCMFIPS(bytes.NewReader(plain), &encrypted, []byte("pass")))

	reader, err := aesDecrypt(bytes.NewReader(encrypted.Bytes()), []byte("pass"), true)
	require.NoError(t, err)
	got, err := io.ReadAll(reader)
	require.NoError(t, err)
	assert.Equal(t, plain, got)
}

func TestREQ_BKP_01_AesDecrypt_NonFIPSHeaderAcceptedWhenFIPSDisabled(t *testing.T) {
	t.Parallel()

	plain := []byte("non-fips decrypt via aesDecrypt")
	var encrypted bytes.Buffer
	require.NoError(t, aesEncryptGCM(bytes.NewReader(plain), &encrypted, []byte("pass")))

	reader, err := aesDecrypt(bytes.NewReader(encrypted.Bytes()), []byte("pass"), false)
	require.NoError(t, err)
	got, err := io.ReadAll(reader)
	require.NoError(t, err)
	assert.Equal(t, plain, got)
}

func TestREQ_BKP_02_AesDecrypt_LegacyOFB(t *testing.T) {
	t.Parallel()

	passphrase := []byte("legacy-pass")
	plain := []byte("legacy OFB archive without header")

	var encrypted bytes.Buffer
	require.NoError(t, legacyAesEncrypt(bytes.NewReader(plain), &encrypted, passphrase))
	assert.False(t, HasEncryptedHeader(encrypted.Bytes()), "legacy ciphertexts have no GCM header")

	// Public AesDecrypt (non-FIPS) falls through to aesDecryptOFB for header-less data.
	reader, err := AesDecrypt(bytes.NewReader(encrypted.Bytes()), passphrase)
	require.NoError(t, err)
	got, err := io.ReadAll(reader)
	require.NoError(t, err)
	assert.Equal(t, plain, got)
}

func TestREQ_BKP_02_AesDecryptOFB_Direct(t *testing.T) {
	t.Parallel()

	passphrase := []byte("ofb-direct")
	plain := []byte("direct OFB helper")

	var encrypted bytes.Buffer
	require.NoError(t, legacyAesEncrypt(bytes.NewReader(plain), &encrypted, passphrase))

	reader, err := aesDecryptOFB(bytes.NewReader(encrypted.Bytes()), passphrase)
	require.NoError(t, err)
	got, err := io.ReadAll(reader)
	require.NoError(t, err)
	assert.Equal(t, plain, got)
}
