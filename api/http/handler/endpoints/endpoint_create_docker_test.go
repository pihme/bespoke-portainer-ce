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
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/filesystem"
	"github.com/portainer/portainer/api/http/proxy"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/snapshot"
	"github.com/portainer/portainer/api/internal/testhelpers"
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

	snap, err := snapshot.NewService("", store, stubDockerSnapshotter{snapshot: &portainer.DockerSnapshot{}})
	require.NoError(t, err)

	fs, err := filesystem.NewService(t.TempDir(), "")
	require.NoError(t, err)

	h := NewHandler(testhelpers.NewTestRequestBouncer())
	h.DataStore = store
	h.ComposeStackManager = testhelpers.NewComposeStackManager()
	h.SnapshotService = snap
	h.ProxyManager = proxy.NewManager()
	h.ProxyManager.NewProxyFactory(nil, nil, nil, nil, nil)
	h.FileService = fs
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

func TestREQ_ENV_11_CreateUnsecuredEndpoint_Direct_SnapshotFailure(t *testing.T) {
	t.Parallel()
	fips.InitFIPS(false)
	_, store := datastore.MustNewTestStore(t, true, false)
	if _, err := store.EndpointGroup().Read(1); err != nil {
		require.NoError(t, store.EndpointGroup().Create(&portainer.EndpointGroup{Name: "default"}))
	}
	snap, err := snapshot.NewService("", store, stubDockerSnapshotter{err: assert.AnError})
	require.NoError(t, err)

	h := &Handler{DataStore: store, SnapshotService: snap}
	payload := &endpointCreatePayload{
		Name:                 "fail-snap",
		URL:                  "unix:///var/run/docker.sock",
		EndpointCreationType: localDockerEnvironment,
	}
	ep, httpErr := h.createUnsecuredEndpoint(store, payload)
	require.NotNil(t, httpErr)
	assert.Nil(t, ep)
	assert.Equal(t, http.StatusInternalServerError, httpErr.StatusCode)
}

// REQ-TAI-013: environment groups and tags are removed. Create ignores the
// GroupID and TagIds form values: the environment joins the Unassigned group
// with no tags and no tag record changes. GPUs and the public URL still apply.
func TestREQ_TAI_013_CreateIgnoresGroupAndTags(t *testing.T) {
	t.Parallel()
	h, store := newCreateDockerHandler(t)
	tag := &portainer.Tag{Name: "create-tag", Endpoints: map[portainer.EndpointID]bool{}, EndpointGroups: map[portainer.EndpointGroupID]bool{}}
	require.NoError(t, store.Tag().Create(tag))
	group := &portainer.EndpointGroup{Name: "legacy-group"}
	require.NoError(t, store.EndpointGroup().Create(group))
	require.NotEqual(t, portainer.EndpointGroupID(1), group.ID)

	req := multipartCreateRequest(t, map[string]string{
		"Name":                 "tagged-docker",
		"EndpointCreationType": "1",
		"URL":                  "unix:///var/run/docker.sock",
		"ContainerEngine":      "docker",
		"GroupID":              strconv.Itoa(int(group.ID)),
		"TagIds":               "[" + strconv.Itoa(int(tag.ID)) + "]",
		"Gpus":                 `[{"name":"gpu0","value":"nvidia.com/gpu=0"}]`,
		"PublicURL":            "docker.example.com",
	}, nil)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	var ep portainer.Endpoint
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &ep))
	assert.Equal(t, portainer.EndpointGroupID(1), ep.GroupID)
	assert.Empty(t, ep.TagIDs)
	assert.Equal(t, "docker.example.com", ep.PublicURL)
	assert.Equal(t, []portainer.Pair{{Name: "gpu0", Value: "nvidia.com/gpu=0"}}, ep.Gpus)

	updated, err := store.Tag().Read(tag.ID)
	require.NoError(t, err)
	assert.False(t, updated.Endpoints[ep.ID])
}

// REQ-TAI-007: the Portainer Agent and remote Docker hosts are removed. Only the
// local Docker or Podman socket can be added; Agent creation (type 2), a TCP or
// HTTP URL and TLS are refused with 400 and nothing is stored.
func TestREQ_TAI_007_CreateRefusesAgentAndRemoteDocker(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name   string
		fields map[string]string
	}{
		{name: "agent environment", fields: map[string]string{"Name": "agent", "EndpointCreationType": "2", "URL": "tcp://agent:9001"}},
		{name: "agent environment without URL", fields: map[string]string{"Name": "agent", "EndpointCreationType": "2"}},
		{name: "docker api over tcp", fields: map[string]string{"Name": "api", "EndpointCreationType": "1", "URL": "tcp://docker.example:2375"}},
		{name: "docker api over http", fields: map[string]string{"Name": "http", "EndpointCreationType": "1", "URL": "http://docker.example:2375"}},
		{name: "docker api with tls", fields: map[string]string{"Name": "tls", "EndpointCreationType": "1", "URL": "tcp://docker.example:2376", "TLS": "true", "TLSSkipVerify": "true", "TLSSkipClientVerify": "true"}},
		{name: "local socket with tls", fields: map[string]string{"Name": "tls-sock", "EndpointCreationType": "1", "URL": "unix:///var/run/docker.sock", "TLS": "true"}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			h, store := newCreateDockerHandler(t)

			w := httptest.NewRecorder()
			h.ServeHTTP(w, multipartCreateRequest(t, tc.fields, nil))
			require.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())

			endpoints, err := store.Endpoint().Endpoints()
			require.NoError(t, err)
			require.Empty(t, endpoints)
		})
	}

	p := &endpointCreatePayload{}
	err := p.Validate(&http.Request{Form: map[string][]string{"Name": {"a"}, "EndpointCreationType": {"2"}}})
	require.ErrorIs(t, err, portainer.ErrAgentEnvironmentNotSupported)

	err = p.Validate(&http.Request{Form: map[string][]string{"Name": {"a"}, "EndpointCreationType": {"1"}, "URL": {"tcp://docker.example:2375"}}})
	require.ErrorIs(t, err, portainer.ErrRemoteEnvironmentNotSupported)
}

// REQ-TAI-008: Azure Container Instances are removed. Azure creation (type 3)
// is refused with 400 before any call to Azure, and nothing is stored.
func TestREQ_TAI_008_CreateRefusesAzure(t *testing.T) {
	t.Parallel()

	h, store := newCreateDockerHandler(t)

	w := httptest.NewRecorder()
	h.ServeHTTP(w, multipartCreateRequest(t, map[string]string{
		"Name":                   "aci",
		"EndpointCreationType":   "3",
		"AzureApplicationID":     "app",
		"AzureTenantID":          "tenant",
		"AzureAuthenticationKey": "key",
	}, nil))
	require.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
	require.Contains(t, w.Body.String(), portainer.ErrAzureEnvironmentNotSupported.Error())

	endpoints, err := store.Endpoint().Endpoints()
	require.NoError(t, err)
	require.Empty(t, endpoints)

	p := &endpointCreatePayload{}
	err = p.Validate(&http.Request{Form: map[string][]string{"Name": {"a"}, "EndpointCreationType": {"3"}}})
	require.ErrorIs(t, err, portainer.ErrAzureEnvironmentNotSupported)
}
