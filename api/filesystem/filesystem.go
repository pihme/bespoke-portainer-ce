package filesystem

import (
	"bytes"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/logs"

	"github.com/google/uuid"
)

const (
	// TLSStorePath represents the subfolder where TLS files are stored in the file store folder.
	TLSStorePath = "tls"

	// TLSCACertFile represents the name on disk for a TLS CA file.
	TLSCACertFile = "ca.pem"
	// TLSCertFile represents the name on disk for a TLS certificate file.
	TLSCertFile = "cert.pem"
	// TLSKeyFile represents the name on disk for a TLS key file.
	TLSKeyFile = "key.pem"
	// ComposeStorePath represents the subfolder where compose files are stored in the file store folder.
	ComposeStorePath = "compose"
	// ComposeFileDefaultName represents the default name of a compose file.
	ComposeFileDefaultName = "docker-compose.yml"

	// PrivateKeyFile represents the name on disk of the file containing the private key.
	PrivateKeyFile = "portainer.key"
	// PublicKeyFile represents the name on disk of the file containing the public key.
	PublicKeyFile = "portainer.pub"
	// BinaryStorePath represents the subfolder where binaries are stored in the file store folder.
	BinaryStorePath = "bin"

	// CustomTemplateStorePath represents the subfolder where custom template files are stored in the file store folder.
	CustomTemplateStorePath = "custom_templates"
	// TempPath represent the subfolder where temporary files are saved
	TempPath = "tmp"
	// SSLCertPath represents the default ssl certificates path
	SSLCertPath = "certs"
	// SSLCertFilename represents the ssl certificate file name
	SSLCertFilename = "cert.pem"
	// SSLKeyFilename represents the ssl key file name
	SSLKeyFilename = "key.pem"
)

// ErrUndefinedTLSFileType represents an error returned on undefined TLS file type
var ErrUndefinedTLSFileType = errors.New("Undefined TLS file type")

// Service represents a service for managing files and directories.
type Service struct {
	dataStorePath string
	fileStorePath string
}

// JoinPaths takes a trusted root path and a list of untrusted paths and joins
// them together using directory separators while enforcing that the untrusted
// paths cannot go higher up than the trusted root
func JoinPaths(trustedRoot string, untrustedPaths ...string) string {
	if trustedRoot == "" {
		trustedRoot = "."
	}

	p := filepath.Join(trustedRoot, filepath.Join(append([]string{"/"}, untrustedPaths...)...))

	// avoid setting a volume name from the untrusted paths
	vnp := filepath.VolumeName(p)
	if filepath.VolumeName(trustedRoot) == "" && vnp != "" {
		return strings.TrimPrefix(strings.TrimPrefix(p, vnp), `\`)
	}

	return p
}

// NewService initializes a new service. It creates a data directory and a directory to store files
// inside this directory if they don't exist.
func NewService(dataStorePath, fileStorePath string) (*Service, error) {
	service := &Service{
		dataStorePath: dataStorePath,
		fileStorePath: JoinPaths(dataStorePath, fileStorePath),
	}

	err := os.MkdirAll(dataStorePath, 0755)
	if err != nil {
		return nil, err
	}

	err = service.createDirectoryInStore(SSLCertPath)
	if err != nil {
		return nil, err
	}

	err = service.createDirectoryInStore(TLSStorePath)
	if err != nil {
		return nil, err
	}

	err = service.createDirectoryInStore(ComposeStorePath)
	if err != nil {
		return nil, err
	}

	err = service.createDirectoryInStore(BinaryStorePath)
	if err != nil {
		return nil, err
	}

	return service, nil
}

// RemoveDirectory removes a directory on the filesystem.
func (service *Service) RemoveDirectory(directoryPath string) error {
	return os.RemoveAll(directoryPath)
}

// GetStackProjectPath returns the absolute path on the FS for a stack based
// on its identifier.
func (service *Service) GetStackProjectPath(stackIdentifier string) string {
	return JoinPaths(service.wrapFileStore(ComposeStorePath), stackIdentifier)
}

// Copy copies the file on fromFilePath to toFilePath
// if toFilePath exists func will fail unless deleteIfExists is true
func (service *Service) Copy(fromFilePath string, toFilePath string, deleteIfExists bool) error {
	exists, err := service.FileExists(fromFilePath)
	if err != nil {
		return err
	}

	if !exists {
		return fmt.Errorf("File (%s) doesn't exist", fromFilePath)
	}

	finput, err := os.Open(fromFilePath)
	if err != nil {
		return err
	}

	defer logs.CloseAndLogErr(finput)

	exists, err = service.FileExists(toFilePath)
	if err != nil {
		return err
	}

	if exists {
		if !deleteIfExists {
			return errors.New("Destination file exists")
		}

		err := os.Remove(toFilePath)
		if err != nil {
			return err
		}
	}

	foutput, err := os.Create(toFilePath)
	if err != nil {
		return err
	}

	defer logs.CloseAndLogErr(foutput)

	buf := make([]byte, 1024)
	for {
		n, err := finput.Read(buf)
		if err != nil && err != io.EOF {
			return err
		}
		if n == 0 {
			break
		}

		if _, err := foutput.Write(buf[:n]); err != nil {
			return err
		}
	}

	return nil
}

// StoreStackFileFromBytes creates a subfolder in the ComposeStorePath and stores a new file from bytes.
// It returns the path to the folder where the file is stored.
func (service *Service) StoreStackFileFromBytes(stackIdentifier, fileName string, data []byte) (string, error) {
	stackStorePath := JoinPaths(ComposeStorePath, stackIdentifier)
	err := service.createDirectoryInStore(stackStorePath)
	if err != nil {
		return "", err
	}

	composeFilePath := JoinPaths(stackStorePath, fileName)
	r := bytes.NewReader(data)

	err = service.createFileInStore(composeFilePath, r)
	if err != nil {
		return "", err
	}

	return service.wrapFileStore(stackStorePath), nil
}

// UpdateStoreStackFileFromBytes makes stack file backup and updates a new file from bytes.
// It returns the path to the folder where the file is stored.
func (service *Service) UpdateStoreStackFileFromBytes(stackIdentifier, fileName string, data []byte) (string, error) {
	stackStorePath := JoinPaths(ComposeStorePath, stackIdentifier)
	composeFilePath := JoinPaths(stackStorePath, fileName)
	err := service.createBackupFileInStore(composeFilePath)
	if err != nil {
		return "", err
	}

	r := bytes.NewReader(data)
	err = service.createFileInStore(composeFilePath, r)
	if err != nil {
		return "", err
	}

	return service.wrapFileStore(stackStorePath), nil
}

// RemoveStackFileBackup removes the stack file backup in the ComposeStorePath.
func (service *Service) RemoveStackFileBackup(stackIdentifier, fileName string) error {
	stackStorePath := JoinPaths(ComposeStorePath, stackIdentifier)
	composeFilePath := JoinPaths(stackStorePath, fileName)

	return service.removeBackupFileInStore(composeFilePath)
}

// RollbackStackFile rollbacks the stack file backup in the ComposeStorePath.
func (service *Service) RollbackStackFile(stackIdentifier, fileName string) error {
	stackStorePath := JoinPaths(ComposeStorePath, stackIdentifier)
	composeFilePath := JoinPaths(stackStorePath, fileName)
	path := service.wrapFileStore(composeFilePath)
	backupPath := path + ".bak"

	exists, err := service.FileExists(backupPath)
	if err != nil {
		return err
	}

	if !exists {
		// keep the updated/failed stack file
		return nil
	}

	err = service.Copy(backupPath, path, true)
	if err != nil {
		return err
	}

	return os.Remove(backupPath)
}

// StoreTLSFileFromBytes creates a folder in the TLSStorePath and stores a new file from bytes.
// It returns the path to the newly created file.
func (service *Service) StoreTLSFileFromBytes(folder string, fileType portainer.TLSFileType, data []byte) (string, error) {
	storePath := JoinPaths(TLSStorePath, folder)
	err := service.createDirectoryInStore(storePath)
	if err != nil {
		return "", err
	}

	var fileName string
	switch fileType {
	case portainer.TLSFileCA:
		fileName = TLSCACertFile
	case portainer.TLSFileCert:
		fileName = TLSCertFile
	case portainer.TLSFileKey:
		fileName = TLSKeyFile
	default:
		return "", ErrUndefinedTLSFileType
	}

	tlsFilePath := JoinPaths(storePath, fileName)
	r := bytes.NewReader(data)
	err = service.createFileInStore(tlsFilePath, r)
	if err != nil {
		return "", err
	}
	return service.wrapFileStore(tlsFilePath), nil
}

// GetPathForTLSFile returns the absolute path to a specific TLS file for an environment(endpoint).
func (service *Service) GetPathForTLSFile(folder string, fileType portainer.TLSFileType) (string, error) {
	var fileName string
	switch fileType {
	case portainer.TLSFileCA:
		fileName = TLSCACertFile
	case portainer.TLSFileCert:
		fileName = TLSCertFile
	case portainer.TLSFileKey:
		fileName = TLSKeyFile
	default:
		return "", ErrUndefinedTLSFileType
	}
	return JoinPaths(service.wrapFileStore(TLSStorePath), folder, fileName), nil
}

// DeleteTLSFiles deletes a folder in the TLS store path.
func (service *Service) DeleteTLSFiles(folder string) error {
	storePath := JoinPaths(service.wrapFileStore(TLSStorePath), folder)
	return os.RemoveAll(storePath)
}

// DeleteTLSFile deletes a specific TLS file from a folder.
func (service *Service) DeleteTLSFile(folder string, fileType portainer.TLSFileType) error {
	var fileName string
	switch fileType {
	case portainer.TLSFileCA:
		fileName = TLSCACertFile
	case portainer.TLSFileCert:
		fileName = TLSCertFile
	case portainer.TLSFileKey:
		fileName = TLSKeyFile
	default:
		return ErrUndefinedTLSFileType
	}

	filePath := JoinPaths(service.wrapFileStore(TLSStorePath), folder, fileName)

	return os.Remove(filePath)
}

// GetFileContent returns the content of a file as bytes.
func (service *Service) GetFileContent(trustedRoot, filePath string) ([]byte, error) {
	content, err := os.ReadFile(JoinPaths(trustedRoot, filePath))
	if err != nil {
		if filePath == "" {
			filePath = trustedRoot
		}
		return nil, fmt.Errorf("could not get the contents of the file '%s'", filePath)
	}

	return content, nil
}

// Rename renames a file or directory
func (service *Service) Rename(oldPath, newPath string) error {
	return os.Rename(oldPath, newPath)
}

// FileExists checks for the existence of the specified file.
func (service *Service) FileExists(filePath string) (bool, error) {
	return FileExists(filePath)
}

// KeyPairFilesExist checks for the existence of the key files.
func (service *Service) KeyPairFilesExist() (bool, error) {
	privateKeyPath := JoinPaths(service.dataStorePath, PrivateKeyFile)
	exists, err := service.FileExists(privateKeyPath)
	if err != nil || !exists {
		return false, err
	}

	publicKeyPath := JoinPaths(service.dataStorePath, PublicKeyFile)
	exists, err = service.FileExists(publicKeyPath)
	if err != nil || !exists {
		return false, err
	}

	return true, nil
}

// StoreKeyPair store the specified keys content as PEM files on disk.
func (service *Service) StoreKeyPair(private, public []byte, privatePEMHeader, publicPEMHeader string) error {
	err := service.createPEMFileInStore(private, privatePEMHeader, PrivateKeyFile)
	if err != nil {
		return err
	}

	return service.createPEMFileInStore(public, publicPEMHeader, PublicKeyFile)
}

// LoadKeyPair retrieve the content of both key files on disk.
func (service *Service) LoadKeyPair() ([]byte, []byte, error) {
	privateKey, err := service.getContentFromPEMFile(PrivateKeyFile)
	if err != nil {
		return nil, nil, err
	}

	publicKey, err := service.getContentFromPEMFile(PublicKeyFile)
	if err != nil {
		return nil, nil, err
	}

	return privateKey, publicKey, nil
}

// createDirectoryInStore creates a new directory in the file store
func (service *Service) createDirectoryInStore(name string) error {
	path := service.wrapFileStore(name)
	return os.MkdirAll(path, 0700)
}

// createFile creates a new file in the file store with the content from r.
func (service *Service) createFileInStore(filePath string, r io.Reader) error {
	path := service.wrapFileStore(filePath)

	return CreateFile(path, r)
}

// createBackupFileInStore makes a copy in the file store.
func (service *Service) createBackupFileInStore(filePath string) error {
	path := service.wrapFileStore(filePath)
	backupPath := path + ".bak"

	return service.Copy(path, backupPath, true)
}

// removeBackupFileInStore removes the copy in the file store.
func (service *Service) removeBackupFileInStore(filePath string) error {
	path := service.wrapFileStore(filePath)
	backupPath := path + ".bak"

	exists, err := service.FileExists(backupPath)
	if err != nil {
		return err
	}

	if exists {
		return os.Remove(backupPath)
	}

	return nil
}

func (service *Service) createPEMFileInStore(content []byte, fileType, filePath string) error {
	path := service.wrapFileStore(filePath)
	block := &pem.Block{Type: fileType, Bytes: content}

	out, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}
	defer logs.CloseAndLogErr(out)

	return pem.Encode(out, block)
}

func (service *Service) getContentFromPEMFile(filePath string) ([]byte, error) {
	path := service.wrapFileStore(filePath)

	fileContent, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	block, _ := pem.Decode(fileContent)
	return block.Bytes, nil
}

// GetCustomTemplateProjectPath returns the absolute path on the FS for a custom template based
// on its identifier.
func (service *Service) GetCustomTemplateProjectPath(identifier string) string {
	return JoinPaths(service.wrapFileStore(CustomTemplateStorePath), identifier)
}

// StoreCustomTemplateFileFromBytes creates a subfolder in the CustomTemplateStorePath and stores a new file from bytes.
// It returns the path to the folder where the file is stored.
func (service *Service) StoreCustomTemplateFileFromBytes(identifier, fileName string, data []byte) (string, error) {
	customTemplateStorePath := JoinPaths(CustomTemplateStorePath, identifier)
	err := service.createDirectoryInStore(customTemplateStorePath)
	if err != nil {
		return "", err
	}

	templateFilePath := JoinPaths(customTemplateStorePath, fileName)
	r := bytes.NewReader(data)

	err = service.createFileInStore(templateFilePath, r)
	if err != nil {
		return "", err
	}

	return service.wrapFileStore(customTemplateStorePath), nil
}

// GetTemporaryPath returns a temp folder
func (service *Service) GetTemporaryPath() (string, error) {
	uid, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}

	return JoinPaths(service.wrapFileStore(TempPath), uid.String()), nil
}

// GetDataStorePath returns path to data folder
func (service *Service) GetDatastorePath() string {
	return service.dataStorePath
}

func (service *Service) wrapFileStore(filepath string) string {
	return JoinPaths(service.fileStorePath, filepath)
}

func defaultCertPathUnderFileStore() (string, string) {
	certPath := JoinPaths(SSLCertPath, SSLCertFilename)
	keyPath := JoinPaths(SSLCertPath, SSLKeyFilename)
	return certPath, keyPath
}

// GetDefaultSSLCertsPath returns the ssl certs path
func (service *Service) GetDefaultSSLCertsPath() (string, string) {
	certPath, keyPath := defaultCertPathUnderFileStore()
	return service.wrapFileStore(certPath), service.wrapFileStore(keyPath)
}

// StoreSSLCertPair stores a ssl certificate pair
func (service *Service) StoreSSLCertPair(cert, key []byte) (string, string, error) {
	certPath, keyPath := defaultCertPathUnderFileStore()

	r := bytes.NewReader(cert)
	err := service.createFileInStore(certPath, r)
	if err != nil {
		return "", "", err
	}

	r = bytes.NewReader(key)
	err = service.createFileInStore(keyPath, r)
	if err != nil {
		return "", "", err
	}

	return service.wrapFileStore(certPath), service.wrapFileStore(keyPath), nil
}

// CopySSLCertPair copies a ssl certificate pair
func (service *Service) CopySSLCertPair(certPath, keyPath string) (string, string, error) {
	defCertPath, defKeyPath := service.GetDefaultSSLCertsPath()

	err := service.Copy(certPath, defCertPath, true)
	if err != nil {
		return "", "", err
	}

	err = service.Copy(keyPath, defKeyPath, true)
	if err != nil {
		return "", "", err
	}

	return defCertPath, defKeyPath, nil
}

// FileExists checks for the existence of the specified file.
func FileExists(filePath string) (bool, error) {
	if _, err := os.Stat(filePath); err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func MoveDirectory(originalPath, newPath string, overwriteTargetPath bool) error {
	if _, err := os.Stat(originalPath); err != nil {
		return err
	}

	alreadyExists, err := FileExists(newPath)
	if err != nil {
		return err
	}

	if alreadyExists {
		if !overwriteTargetPath {
			return errors.New("Target path already exists")
		}

		if err = os.RemoveAll(newPath); err != nil {
			return fmt.Errorf("failed to overwrite path %s: %s", newPath, err.Error())
		}
	}

	return os.Rename(originalPath, newPath)
}

func CreateFile(path string, r io.Reader) error {
	out, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return err
	}

	defer logs.CloseAndLogErr(out)

	_, err = io.Copy(out, r)
	return err
}
