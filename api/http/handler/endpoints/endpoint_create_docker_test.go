package endpoints

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/chisel"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/http/proxy"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/snapshot"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/api/pendingactions"
	"github.com/portainer/portainer/pkg/fips"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubDockerSnapshotter struct {
	snapshot *portainer.DockerSnapshot
	err      error
}

func (s stubDockerSnapshotter) CreateSnapshot(endpoint *portainer.Endpoint) (*portainer.DockerSnapshot, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.snapshot, nil
}

func newCreateDockerHandler(t *testing.T) (*Handler, *datastore.Store) {
	t.Helper()
	fips.InitFIPS(false)
	_, store := datastore.MustNewTestStore(t, true, false)
	_ = store.User().Create(&portainer.User{Username: "admin", Role: portainer.AdministratorRole})
	if _, err := store.EndpointGroup().Read(1); err != nil {
		require.NoError(t, store.EndpointGroup().Create(&portainer.EndpointGroup{Name: "default"}))
	}

	snap, err := snapshot.NewService("", store, stubDockerSnapshotter{snapshot: &portainer.DockerSnapshot{}}, stubKubernetesSnapshotter{}, nil)
	require.NoError(t, err)

	fs, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)

	h := NewHandler(testhelpers.NewTestRequestBouncer())
	h.DataStore = store
	h.ComposeStackManager = testhelpers.NewComposeStackManager()
	h.SnapshotService = snap
	h.PendingActionsService = pendingactions.NewService(store, nil)
	h.ProxyManager = proxy.NewManager(nil)
	h.ProxyManager.NewProxyFactory(nil, nil, nil, nil, nil, nil, nil, nil, nil)
	h.FileService = fs
	h.ReverseTunnelService = chisel.NewService(store, nil, nil)
	return h, store
}

func multipartCreateRequest(t *testing.T, fields map[string]string, files map[string][]byte) *http.Request {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	for k, v := range fields {
		require.NoError(t, w.WriteField(k, v))
	}
	for name, data := range files {
		part, err := w.CreateFormFile(name, name+".pem")
		require.NoError(t, err)
		_, err = part.Write(data)
		require.NoError(t, err)
	}
	require.NoError(t, w.Close())

	r := httptest.NewRequest(http.MethodPost, "/endpoints", &body)
	r.Header.Set("Content-Type", w.FormDataContentType())
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{
		IsAdmin: true,
		UserID:  1,
		User:    &portainer.User{ID: 1, Role: portainer.AdministratorRole},
	}))
	r = r.WithContext(security.StoreTokenData(r, &portainer.TokenData{
		ID: 1, Username: "admin", Role: portainer.AdministratorRole,
	}))
	testhelpers.AddTestSecurityCookie(r, "Bearer dummytoken")
	return r
}

func TestREQ_ENV_11_CreateUnsecuredDockerEndpoint_Persists(t *testing.T) {
	t.Parallel()
	h, store := newCreateDockerHandler(t)

	req := multipartCreateRequest(t, map[string]string{
		"Name":                 "local-docker",
		"EndpointCreationType": "1",
		"URL":                  "unix:///var/run/docker.sock",
		"ContainerEngine":      "docker",
	}, nil)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var ep portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &ep))
	assert.Equal(t, "local-docker", ep.Name)
	assert.Equal(t, portainer.DockerEnvironment, ep.Type)
	assert.Equal(t, "unix:///var/run/docker.sock", ep.URL)

	stored, err := store.Endpoint().Endpoint(ep.ID)
	require.NoError(t, err)
	assert.Equal(t, "local-docker", stored.Name)

	rel, err := store.EndpointRelation().EndpointRelation(ep.ID)
	require.NoError(t, err)
	assert.NotNil(t, rel)
}

func TestREQ_ENV_11_CreateUnsecuredDockerEndpoint_DefaultSocketURL(t *testing.T) {
	t.Parallel()
	h, _ := newCreateDockerHandler(t)

	req := multipartCreateRequest(t, map[string]string{
		"Name":                 "socket-default",
		"EndpointCreationType": "1",
		"ContainerEngine":      "docker",
	}, nil)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var ep portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &ep))
	assert.Contains(t, ep.URL, "docker")
}

func TestREQ_ENV_11_CreateDockerEndpoint_NameConflict_ReturnsConflict(t *testing.T) {
	t.Parallel()
	h, store := newCreateDockerHandler(t)
	createDockerEndpoint(t, store, 1, "taken")

	req := multipartCreateRequest(t, map[string]string{
		"Name":                 "taken",
		"EndpointCreationType": "1",
		"URL":                  "unix:///var/run/docker.sock",
	}, nil)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusConflict, w.Code, w.Body.String())
}

func TestREQ_ENV_11_CreateDockerEndpoint_InvalidPayload_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, _ := newCreateDockerHandler(t)
	req := multipartCreateRequest(t, map[string]string{
		"EndpointCreationType": "1",
	}, nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_ENV_11_CreateTLSSecuredDockerEndpoint_SkipVerifyAndClient(t *testing.T) {
	t.Parallel()
	h, store := newCreateDockerHandler(t)

	req := multipartCreateRequest(t, map[string]string{
		"Name":                 "tls-docker",
		"EndpointCreationType": "1",
		"URL":                  "tcp://docker.example:2376",
		"TLS":                  "true",
		"TLSSkipVerify":        "true",
		"TLSSkipClientVerify":  "true",
		"ContainerEngine":      "docker",
	}, nil)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var ep portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &ep))
	assert.True(t, ep.TLSConfig.TLS)
	assert.True(t, ep.TLSConfig.TLSSkipVerify)

	stored, err := store.Endpoint().Endpoint(ep.ID)
	require.NoError(t, err)
	assert.Equal(t, "tls-docker", stored.Name)
}

func TestREQ_ENV_11_StoreTLSFiles_PersistsCACertAndClientPair(t *testing.T) {
	t.Parallel()
	h, _ := newCreateDockerHandler(t)

	ep := &portainer.Endpoint{ID: 9, TLSConfig: portainer.TLSConfiguration{TLS: true}}
	payload := &endpointCreatePayload{
		TLS:               true,
		TLSSkipVerify:     false,
		TLSSkipClientVerify: false,
		TLSCACertFile:     []byte("ca-data"),
		TLSCertFile:       []byte("cert-data"),
		TLSKeyFile:        []byte("key-data"),
	}
	httpErr := h.storeTLSFiles(ep, payload)
	require.Nil(t, httpErr)
	assert.NotEmpty(t, ep.TLSConfig.TLSCACertPath)
	assert.NotEmpty(t, ep.TLSConfig.TLSCertPath)
	assert.NotEmpty(t, ep.TLSConfig.TLSKeyPath)
}

func TestREQ_ENV_11_StoreTLSFiles_SkipClientVerify_StoresOnlyCA(t *testing.T) {
	t.Parallel()
	h, _ := newCreateDockerHandler(t)

	ep := &portainer.Endpoint{ID: 10, TLSConfig: portainer.TLSConfiguration{TLS: true}}
	payload := &endpointCreatePayload{
		TLS:                 true,
		TLSSkipVerify:       false,
		TLSSkipClientVerify: true,
		TLSCACertFile:       []byte("ca-only"),
	}
	httpErr := h.storeTLSFiles(ep, payload)
	require.Nil(t, httpErr)
	assert.NotEmpty(t, ep.TLSConfig.TLSCACertPath)
	assert.Empty(t, ep.TLSConfig.TLSCertPath)
}

func TestREQ_ENV_11_CreateUnsecuredEndpoint_Direct_SnapshotFailure(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	_, store := datastore.MustNewTestStore(t, true, false)
	if _, err := store.EndpointGroup().Read(1); err != nil {
		require.NoError(t, store.EndpointGroup().Create(&portainer.EndpointGroup{Name: "default"}))
	}
	snap, err := snapshot.NewService("", store, stubDockerSnapshotter{err: assert.AnError}, nil, nil)
	require.NoError(t, err)

	h := &Handler{DataStore: store, SnapshotService: snap}
	payload := &endpointCreatePayload{
		Name:                 "fail-snap",
		URL:                  "unix:///var/run/docker.sock",
		EndpointCreationType: localDockerEnvironment,
		GroupID:              1,
	}
	ep, httpErr := h.createUnsecuredEndpoint(store, payload)
	require.NotNil(t, httpErr)
	assert.Nil(t, ep)
	assert.Equal(t, http.StatusInternalServerError, httpErr.StatusCode)
}

func TestREQ_ENV_11_CreateUnsecuredDockerEndpoint_WithTagsAndGpus(t *testing.T) {
	t.Parallel()
	h, store := newCreateDockerHandler(t)
	tag := &portainer.Tag{Name: "create-tag", Endpoints: map[portainer.EndpointID]bool{}, EndpointGroups: map[portainer.EndpointGroupID]bool{}}
	require.NoError(t, store.Tag().Create(tag))

	req := multipartCreateRequest(t, map[string]string{
		"Name":                 "tagged-docker",
		"EndpointCreationType": "1",
		"URL":                  "unix:///var/run/docker.sock",
		"ContainerEngine":      "docker",
		"TagIds":               "[" + strconv.Itoa(int(tag.ID)) + "]",
		"Gpus":                 `[{"name":"gpu0","value":"nvidia.com/gpu=0"}]`,
		"PublicURL":            "docker.example.com",
	}, nil)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var ep portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &ep))
	assert.Equal(t, []portainer.TagID{tag.ID}, ep.TagIDs)
	assert.Equal(t, "docker.example.com", ep.PublicURL)
	assert.Equal(t, []portainer.Pair{{Name: "gpu0", Value: "nvidia.com/gpu=0"}}, ep.Gpus)

	updated, err := store.Tag().Read(tag.ID)
	require.NoError(t, err)
	assert.True(t, updated.Endpoints[ep.ID])
}

func TestREQ_ENV_11_CreateTLSSecuredDockerEndpoint_WithCAAndClientFiles(t *testing.T) {
	t.Parallel()
	h, _ := newCreateDockerHandler(t)

	req := multipartCreateRequest(t, map[string]string{
		"Name":                 "tls-files",
		"EndpointCreationType": "1",
		"URL":                  "tcp://docker.example:2376",
		"TLS":                  "true",
		"TLSSkipVerify":        "false",
		"TLSSkipClientVerify":  "false",
		"ContainerEngine":      "docker",
	}, map[string][]byte{
		"TLSCACertFile": []byte("ca"),
		"TLSCertFile":   []byte("cert"),
		"TLSKeyFile":    []byte("key"),
	})

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var ep portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &ep))
	assert.True(t, ep.TLSConfig.TLS)
	assert.NotEmpty(t, ep.TLSConfig.TLSCACertPath)
	assert.NotEmpty(t, ep.TLSConfig.TLSCertPath)
	assert.NotEmpty(t, ep.TLSConfig.TLSKeyPath)
}
