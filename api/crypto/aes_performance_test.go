//go:build performance

// Performance-labeled test (COV-005, F-05): it encrypts and decrypts about
// 100 MB per case and takes about 20 s, so it is left out of the reference
// test set. Run it with `make test-performance`.

package crypto

import (
	"io"
	"os"
	"testing"

	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/logs"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_encryptAndDecrypt_withTheSamePassword(t *testing.T) {
	const passphrase = "passphrase"

	testFunc := func(t *testing.T, encrypt encryptFunc, decrypt decryptFunc, decryptShouldSucceed bool) {
		tmpdir := t.TempDir()

		var (
			originFilePath    = filesystem.JoinPaths(tmpdir, "origin")
			encryptedFilePath = filesystem.JoinPaths(tmpdir, "encrypted")
			decryptedFilePath = filesystem.JoinPaths(tmpdir, "decrypted")
		)

		content := randBytes(1024*1024*100 + 523)
		err := os.WriteFile(originFilePath, content, 0600)
		require.NoError(t, err)

		originFile, _ := os.Open(originFilePath)
		defer logs.CloseAndLogErr(originFile)

		encryptedFileWriter, _ := os.Create(encryptedFilePath)

		err = encrypt(originFile, encryptedFileWriter, []byte(passphrase))
		require.NoError(t, err, "Failed to encrypt a file")
		logs.CloseAndLogErr(encryptedFileWriter)

		encryptedContent, err := os.ReadFile(encryptedFilePath)
		require.NoError(t, err, "Couldn't read encrypted file")
		assert.NotEqual(t, encryptedContent, content, "Content wasn't encrypted")

		encryptedFileReader, err := os.Open(encryptedFilePath)
		require.NoError(t, err)
		defer logs.CloseAndLogErr(encryptedFileReader)

		decryptedFileWriter, err := os.Create(decryptedFilePath)
		require.NoError(t, err)
		defer logs.CloseAndLogErr(decryptedFileWriter)

		decryptedReader, err := decrypt(encryptedFileReader, []byte(passphrase))
		if !decryptShouldSucceed {
			require.Error(t, err, "Failed to decrypt file as indicated by decryptShouldSucceed")
		} else {
			require.NoError(t, err, "Failed to decrypt file indicated by decryptShouldSucceed")

			_, err = io.Copy(decryptedFileWriter, decryptedReader)
			require.NoError(t, err)

			decryptedContent, err := os.ReadFile(decryptedFilePath)
			require.NoError(t, err)
			assert.Equal(t, content, decryptedContent, "Original and decrypted content should match")
		}
	}

	t.Run("fips", func(t *testing.T) {
		testFunc(t, aesEncryptGCMFIPS, aesDecryptGCMFIPS, true)
	})

	t.Run("non_fips", func(t *testing.T) {
		testFunc(t, aesEncryptGCM, aesDecryptGCM, true)
	})

	t.Run("system_fips_mode_public_entry_points", func(t *testing.T) {
		// use the init mode, public entry points
		testFunc(t, AesEncrypt, AesDecrypt, true)
	})

	t.Run("fips_encrypted_file_header_fails_in_non_fips_mode", func(t *testing.T) {
		// use aesDecrypt which checks the header, confirm that it fails
		decrypt := func(input io.Reader, passphrase []byte) (io.Reader, error) {
			return aesDecrypt(input, passphrase, false)
		}

		testFunc(t, aesEncryptGCMFIPS, decrypt, false)
	})

	t.Run("non_fips_encrypted_file_header_fails_in_fips_mode", func(t *testing.T) {
		// use aesDecrypt which checks the header, confirm that it fails
		decrypt := func(input io.Reader, passphrase []byte) (io.Reader, error) {
			return aesDecrypt(input, passphrase, true)
		}

		testFunc(t, aesEncryptGCM, decrypt, false)
	})

	t.Run("fips_encrypted_file_fails_in_non_fips_mode", func(t *testing.T) {
		testFunc(t, aesEncryptGCMFIPS, aesDecryptGCM, false)
	})

	t.Run("non_fips_encrypted_file_with_fips_mode_should_fail", func(t *testing.T) {
		testFunc(t, aesEncryptGCM, aesDecryptGCMFIPS, false)
	})

	t.Run("fips_with_base_aesDecrypt", func(t *testing.T) {
		// maximize coverage, use the base aesDecrypt function with valid fips mode
		decrypt := func(input io.Reader, passphrase []byte) (io.Reader, error) {
			return aesDecrypt(input, passphrase, true)
		}

		testFunc(t, aesEncryptGCMFIPS, decrypt, true)
	})

	t.Run("legacy", func(t *testing.T) {
		testFunc(t, legacyAesEncrypt, aesDecryptOFB, true)
	})
}
