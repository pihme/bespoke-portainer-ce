package endpointutils

import (
	"context"
	"errors"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/pkg/fips"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func strPtr(s string) *string { return &s }
func boolPtr(b bool) *bool    { return &b }

type stubSnapshotService struct {
	err    error
	called int
}

func (s *stubSnapshotService) Start(context.Context)                              {}
func (s *stubSnapshotService) SetSnapshotInterval(string) error                   { return nil }
func (s *stubSnapshotService) FillSnapshotData(*portainer.Endpoint, bool) error   { return nil }
func (s *stubSnapshotService) SnapshotEndpoint(*portainer.Endpoint) error {
	s.called++
	return s.err
}

type setupEndpointService struct {
	dataservices.EndpointService
	endpoints   []portainer.Endpoint
	listErr     error
	createErr   error
	nextID      int
	created     []*portainer.Endpoint
}

func (s *setupEndpointService) Endpoints() ([]portainer.Endpoint, error) {
	if s.listErr != nil {
		return nil, s.listErr
	}
	return s.endpoints, nil
}

func (s *setupEndpointService) GetNextIdentifier() int {
	if s.nextID == 0 {
		return len(s.endpoints) + 1
	}
	id := s.nextID
	s.nextID++
	return id
}

func (s *setupEndpointService) Create(endpoint *portainer.Endpoint) error {
	if s.createErr != nil {
		return s.createErr
	}
	s.created = append(s.created, endpoint)
	s.endpoints = append(s.endpoints, *endpoint)
	return nil
}

type setupDataStore struct {
	dataservices.DataStore
	endpoint dataservices.EndpointService
}

func (s *setupDataStore) Endpoint() dataservices.EndpointService { return s.endpoint }

func TestREQ_ENV_04_InitEndpoint_EmptyURLSkipsCreate(t *testing.T) {
	t.Parallel()

	svc := &setupEndpointService{}
	store := &setupDataStore{endpoint: svc}
	flags := &portainer.CLIFlags{
		EndpointURL:   strPtr(""),
		TLS:           boolPtr(false),
		TLSSkipVerify: boolPtr(false),
	}

	err := initEndpoint(flags, store, &stubSnapshotService{})
	require.NoError(t, err)
	assert.Empty(t, svc.created)
}

func TestREQ_ENV_04_InitEndpoint_ExistingEnvironmentsSkipped(t *testing.T) {
	t.Parallel()

	svc := &setupEndpointService{
		endpoints: []portainer.Endpoint{{ID: 1, Name: "already-there", URL: "unix:///var/run/docker.sock"}},
	}
	store := &setupDataStore{endpoint: svc}
	flags := &portainer.CLIFlags{
		EndpointURL:   strPtr("unix:///var/run/docker.sock"),
		TLS:           boolPtr(false),
		TLSSkipVerify: boolPtr(false),
	}

	err := initEndpoint(flags, store, &stubSnapshotService{})
	require.NoError(t, err)
	assert.Empty(t, svc.created)
}

func TestREQ_ENV_04_InitEndpoint_ListError(t *testing.T) {
	t.Parallel()

	svc := &setupEndpointService{listErr: errors.New("list failed")}
	store := &setupDataStore{endpoint: svc}
	flags := &portainer.CLIFlags{
		EndpointURL:   strPtr("unix:///var/run/docker.sock"),
		TLS:           boolPtr(false),
		TLSSkipVerify: boolPtr(false),
	}

	err := initEndpoint(flags, store, &stubSnapshotService{})
	require.Error(t, err)
	assert.EqualError(t, err, "list failed")
}

func TestREQ_ENV_04_CreateUnsecuredLocalUnixEndpoint(t *testing.T) {
	t.Parallel()

	svc := &setupEndpointService{nextID: 7}
	store := &setupDataStore{endpoint: svc}
	snap := &stubSnapshotService{err: errors.New("snapshot unavailable")}

	err := createUnsecuredEndpoint("unix:///var/run/docker.sock", store, snap)
	require.NoError(t, err)
	require.Len(t, svc.created, 1)
	assert.Equal(t, 1, snap.called)

	created := svc.created[0]
	assert.Equal(t, portainer.EndpointID(7), created.ID)
	assert.Equal(t, "primary", created.Name)
	assert.Equal(t, "unix:///var/run/docker.sock", created.URL)
	assert.Equal(t, portainer.DockerEnvironment, created.Type)
	assert.Equal(t, portainer.EndpointStatusUp, created.Status)
	assert.True(t, IsLocalEndpoint(created))
	assert.True(t, IsDockerEndpoint(created))
}

func TestREQ_ENV_04_CreateUnsecuredEndpoint_CreateError(t *testing.T) {
	t.Parallel()

	svc := &setupEndpointService{nextID: 1, createErr: errors.New("persist failed")}
	store := &setupDataStore{endpoint: svc}

	err := createUnsecuredEndpoint("unix:///var/run/docker.sock", store, &stubSnapshotService{})
	require.EqualError(t, err, "persist failed")
}

func TestREQ_ENV_04_InitEndpoint_CreatesUnsecuredLocalDocker(t *testing.T) {
	t.Parallel()

	svc := &setupEndpointService{nextID: 3}
	store := &setupDataStore{endpoint: svc}
	flags := &portainer.CLIFlags{
		EndpointURL:   strPtr("unix:///var/run/docker.sock"),
		TLS:           boolPtr(false),
		TLSSkipVerify: boolPtr(false),
	}

	err := initEndpoint(flags, store, &stubSnapshotService{})
	require.NoError(t, err)
	require.Len(t, svc.created, 1)
	assert.Equal(t, portainer.DockerEnvironment, svc.created[0].Type)
	assert.Equal(t, "unix:///var/run/docker.sock", svc.created[0].URL)
}

func TestREQ_ENV_04_CreateTLSSecuredEndpoint_SkipVerifyLocalUnix(t *testing.T) {
	t.Parallel()

	svc := &setupEndpointService{nextID: 11}
	store := &setupDataStore{endpoint: svc}
	flags := &portainer.CLIFlags{
		EndpointURL:   strPtr("unix:///var/run/docker.sock"),
		TLS:           boolPtr(false),
		TLSSkipVerify: boolPtr(true),
		TLSCacert:     strPtr(""),
		TLSCert:       strPtr(""),
		TLSKey:        strPtr(""),
	}

	err := createTLSSecuredEndpoint(flags, store, &stubSnapshotService{})
	require.NoError(t, err)
	require.Len(t, svc.created, 1)

	created := svc.created[0]
	assert.True(t, created.TLSConfig.TLS)
	assert.True(t, created.TLSConfig.TLSSkipVerify)
	assert.Equal(t, portainer.DockerEnvironment, created.Type)
}

func TestREQ_ENV_04_CreateTLSSecuredEndpoint_WithCertPaths(t *testing.T) {
	t.Parallel()

	svc := &setupEndpointService{nextID: 12}
	store := &setupDataStore{endpoint: svc}
	flags := &portainer.CLIFlags{
		EndpointURL:   strPtr("npipe://./pipe/docker_engine"),
		TLS:           boolPtr(true),
		TLSSkipVerify: boolPtr(false),
		TLSCacert:     strPtr("/tmp/ca.pem"),
		TLSCert:       strPtr("/tmp/cert.pem"),
		TLSKey:        strPtr("/tmp/key.pem"),
	}

	err := createTLSSecuredEndpoint(flags, store, &stubSnapshotService{err: errors.New("snap err")})
	require.NoError(t, err)
	require.Len(t, svc.created, 1)

	created := svc.created[0]
	assert.True(t, created.TLSConfig.TLS)
	assert.Equal(t, "/tmp/ca.pem", created.TLSConfig.TLSCACertPath)
	assert.Equal(t, "/tmp/cert.pem", created.TLSConfig.TLSCertPath)
	assert.Equal(t, "/tmp/key.pem", created.TLSConfig.TLSKeyPath)
	assert.True(t, IsLocalEndpoint(created))
}

func TestREQ_ENV_04_CreateTLSSecuredEndpoint_TCPPingFails(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)

	svc := &setupEndpointService{nextID: 13}
	store := &setupDataStore{endpoint: svc}
	flags := &portainer.CLIFlags{
		EndpointURL:   strPtr("tcp://127.0.0.1:1"),
		TLS:           boolPtr(true),
		TLSSkipVerify: boolPtr(true),
		TLSCacert:     strPtr(""),
		TLSCert:       strPtr(""),
		TLSKey:        strPtr(""),
	}

	err := createTLSSecuredEndpoint(flags, store, &stubSnapshotService{})
	require.Error(t, err)
	assert.Empty(t, svc.created)
}

func TestREQ_ENV_04_InitEndpoint_RoutesToTLS(t *testing.T) {
	t.Parallel()

	svc := &setupEndpointService{nextID: 4}
	store := &setupDataStore{endpoint: svc}
	flags := &portainer.CLIFlags{
		EndpointURL:   strPtr("unix:///var/run/docker.sock"),
		TLS:           boolPtr(true),
		TLSSkipVerify: boolPtr(false),
		TLSCacert:     strPtr("/ca"),
		TLSCert:       strPtr("/cert"),
		TLSKey:        strPtr("/key"),
	}

	err := initEndpoint(flags, store, &stubSnapshotService{})
	require.NoError(t, err)
	require.Len(t, svc.created, 1)
	assert.True(t, svc.created[0].TLSConfig.TLS)
}

func TestREQ_ENV_04_InitEndpoint_ShutdownCancels(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	adminDone := make(chan struct{})
	flags := &portainer.CLIFlags{EndpointURL: strPtr("unix:///var/run/docker.sock")}
	store := testhelpers.NewDatastore(testhelpers.WithEndpoints(nil))

	// Must return promptly via shutdown without calling log.Fatal.
	InitEndpoint(ctx, adminDone, flags, store, &stubSnapshotService{})
}

func TestREQ_ENV_04_InitEndpoint_AdminCreationDoneEmptyURL(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	adminDone := make(chan struct{})
	close(adminDone)

	svc := &setupEndpointService{}
	store := &setupDataStore{endpoint: svc}
	flags := &portainer.CLIFlags{
		EndpointURL:   strPtr(""),
		TLS:           boolPtr(false),
		TLSSkipVerify: boolPtr(false),
	}

	InitEndpoint(ctx, adminDone, flags, store, &stubSnapshotService{})
	assert.Empty(t, svc.created)
}

func TestCreateOfflineUnsecuredEndpoint(t *testing.T) {
	t.Parallel()
	err := createUnsecuredEndpoint("tcp://localhost:1", nil, nil)
	require.Error(t, err)
}
