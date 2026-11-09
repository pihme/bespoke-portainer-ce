package docker

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/authorization"

	"github.com/docker/docker/api/types/volume"
	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/require"
)

const volumeCreationAPIVersion = "1.51"

type volumeCreationFixtures struct {
	dockerSrv  *httptest.Server
	ds         dataservices.DataStore
	stdUser    portainer.User
	adminUser  portainer.User
	endpointID portainer.EndpointID
}

func newVolumeCreationFixtures(t *testing.T) *volumeCreationFixtures {
	t.Helper()

	dockerSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead && r.URL.Path == "/_ping" {
			w.Header().Add("Api-Version", volumeCreationAPIVersion)
			_, _ = w.Write([]byte{})

			return
		}

		if r.Method == http.MethodPost {
			data, err := json.Marshal(map[string]string{"Name": "test-volume"})
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)

				return
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write(data)

			return
		}

		http.NotFound(w, r)
	}))
	t.Cleanup(dockerSrv.Close)

	_, store := datastore.MustNewTestStore(t, true, false)

	f := &volumeCreationFixtures{
		dockerSrv:  dockerSrv,
		ds:         store,
		stdUser:    portainer.User{ID: 1, Username: "std", Role: portainer.StandardUserRole},
		adminUser:  portainer.User{ID: 2, Username: "admin", Role: portainer.AdministratorRole},
		endpointID: portainer.EndpointID(1),
	}

	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		err := tx.User().Create(&f.stdUser)
		require.NoError(t, err)

		err = tx.User().Create(&f.adminUser)
		require.NoError(t, err)

		err = tx.Endpoint().Create(&portainer.Endpoint{ID: f.endpointID, Name: "test-env"})
		require.NoError(t, err)

		return nil
	})
	require.NoError(t, err)

	return f
}

func (f *volumeCreationFixtures) setSecuritySettings(t *testing.T, settings portainer.EndpointSecuritySettings) {
	t.Helper()

	err := f.ds.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.Endpoint().UpdateEndpoint(f.endpointID, &portainer.Endpoint{
			ID:               f.endpointID,
			Name:             "test-env",
			SecuritySettings: settings,
		})
	})
	require.NoError(t, err)
}

func (f *volumeCreationFixtures) newTransport() *Transport {
	return &Transport{
		endpoint:      &portainer.Endpoint{ID: f.endpointID},
		dataStore:     f.ds,
		HTTPTransport: &http.Transport{},
	}
}

func (f *volumeCreationFixtures) newRequest(t *testing.T, body volume.CreateOptions, user portainer.User) *http.Request {
	t.Helper()

	data, err := json.Marshal(body)
	require.NoError(t, err)

	req, err := http.NewRequestWithContext(
		t.Context(),
		http.MethodPost,
		f.dockerSrv.URL+"/v"+volumeCreationAPIVersion+"/volumes/create",
		bytes.NewReader(data),
	)
	require.NoError(t, err)

	return req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
		ID:       user.ID,
		Username: user.Username,
		Role:     user.Role,
	}))
}

func TestDecorateVolumeResourceCreationOperation_BindDriverOptForbidden(t *testing.T) {
	t.Parallel()

	f := newVolumeCreationFixtures(t)
	f.setSecuritySettings(t, portainer.EndpointSecuritySettings{
		AllowBindMountsForRegularUsers: false,
	})

	body := volume.CreateOptions{
		Name:   "evil-volume",
		Driver: "local",
		DriverOpts: map[string]string{
			"type":   "bind",
			"device": "/etc",
			"o":      "bind",
		},
	}

	resp, err := f.newTransport().decorateVolumeResourceCreationOperation(f.newRequest(t, body, f.stdUser), portainer.VolumeResourceControl)
	require.ErrorIs(t, err, ErrBindMountsForbidden)
	require.NotNil(t, resp)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)
	err = resp.Body.Close()
	require.NoError(t, err)
}

func TestDecorateVolumeResourceCreationOperation_BindDriverOptAllowedForAdmin(t *testing.T) {
	t.Parallel()

	f := newVolumeCreationFixtures(t)
	f.setSecuritySettings(t, portainer.EndpointSecuritySettings{
		AllowBindMountsForRegularUsers: false,
	})

	body := volume.CreateOptions{
		Name:   "admin-volume",
		Driver: "local",
		DriverOpts: map[string]string{
			"type":   "bind",
			"device": "/etc",
		},
	}

	resp, err := f.newTransport().decorateVolumeResourceCreationOperation(f.newRequest(t, body, f.adminUser), portainer.VolumeResourceControl)
	require.NotErrorIs(t, err, ErrBindMountsForbidden)
	require.NotNil(t, resp)
	require.NotEqual(t, http.StatusForbidden, resp.StatusCode)
	err = resp.Body.Close()
	require.NoError(t, err)
}

func TestDecorateVolumeResourceCreationOperation_BindDriverOptAllowedWhenSettingPermissive(t *testing.T) {
	t.Parallel()

	f := newVolumeCreationFixtures(t)
	f.setSecuritySettings(t, portainer.EndpointSecuritySettings{
		AllowBindMountsForRegularUsers: true,
	})

	body := volume.CreateOptions{
		Name:   "allowed-volume",
		Driver: "local",
		DriverOpts: map[string]string{
			"type":   "bind",
			"device": "/data",
		},
	}

	resp, err := f.newTransport().decorateVolumeResourceCreationOperation(f.newRequest(t, body, f.stdUser), portainer.VolumeResourceControl)
	require.NotErrorIs(t, err, ErrBindMountsForbidden)
	require.NotNil(t, resp)
	require.NotEqual(t, http.StatusForbidden, resp.StatusCode)
	err = resp.Body.Close()
	require.NoError(t, err)
}

func TestDecorateVolumeResourceCreationOperation_BindMountRestrictions(t *testing.T) {
	t.Parallel()

	f := func(driverOpts map[string]string) {
		t.Helper()

		fx := newVolumeCreationFixtures(t)
		fx.setSecuritySettings(t, portainer.EndpointSecuritySettings{
			AllowBindMountsForRegularUsers: false,
		})

		body := volume.CreateOptions{
			Name:       "evil-volume",
			Driver:     "local",
			DriverOpts: driverOpts,
		}

		resp, err := fx.newTransport().decorateVolumeResourceCreationOperation(fx.newRequest(t, body, fx.stdUser), portainer.VolumeResourceControl)
		require.ErrorIs(t, err, ErrBindMountsForbidden)
		require.NotNil(t, resp)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)

		require.NoError(t, resp.Body.Close())
	}

	// local driver's "type=none,o=bind" trick is forbidden
	f(map[string]string{"type": "none", "device": "/etc", "o": "bind"})

	// a real filesystem type mounted via a device is forbidden
	f(map[string]string{"type": "ext4", "device": "/dev/sda1"})

	// "type" match is case-insensitive
	f(map[string]string{"type": "BIND", "device": "/etc"})
}

func TestDecorateVolumeResourceCreationOperation_NonBindDriverOptNotForbidden(t *testing.T) {
	t.Parallel()

	f := newVolumeCreationFixtures(t)
	f.setSecuritySettings(t, portainer.EndpointSecuritySettings{
		AllowBindMountsForRegularUsers: false,
	})

	body := volume.CreateOptions{
		Name:   "normal-volume",
		Driver: "local",
		DriverOpts: map[string]string{
			"type": "tmpfs",
		},
	}

	resp, err := f.newTransport().decorateVolumeResourceCreationOperation(f.newRequest(t, body, f.stdUser), portainer.VolumeResourceControl)
	require.NotErrorIs(t, err, ErrBindMountsForbidden)
	require.NotNil(t, resp)
	require.NotEqual(t, http.StatusForbidden, resp.StatusCode)
	err = resp.Body.Close()
	require.NoError(t, err)
}

func jsonHTTPResponse(t *testing.T, status int, body any) *http.Response {
	t.Helper()

	data, err := json.Marshal(body)
	require.NoError(t, err)

	return &http.Response{
		StatusCode: status,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(data)),
	}
}

func TestREQ_VOL_01_SelectorVolumeLabels(t *testing.T) {
	t.Parallel()

	labels := map[string]any{"com.docker.compose.project": "app"}
	got := selectorVolumeLabels(map[string]any{"Name": "v1", "Labels": labels})
	require.Equal(t, labels, got)

	require.Nil(t, selectorVolumeLabels(map[string]any{"Name": "v1"}))
}

func TestREQ_VOL_02_CheckVolumeBodyRestrictions(t *testing.T) {
	t.Parallel()

	t.Run("allows ordinary local volume", func(t *testing.T) {
		t.Parallel()
		body := []byte(`{"Driver":"local","Name":"ok"}`)
		req := httptest.NewRequest(http.MethodPost, "/volumes/create", bytes.NewReader(body))
		require.NoError(t, CheckVolumeBodyRestrictions(req))

		rewound, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		require.Equal(t, body, rewound)
	})

	t.Run("rejects bind driver opts", func(t *testing.T) {
		t.Parallel()
		body := []byte(`{"Driver":"local","DriverOpts":{"type":"bind","device":"/etc","o":"bind"}}`)
		req := httptest.NewRequest(http.MethodPost, "/volumes/create", bytes.NewReader(body))
		require.ErrorIs(t, CheckVolumeBodyRestrictions(req), ErrBindMountsForbidden)
	})

	t.Run("rejects invalid json", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodPost, "/volumes/create", bytes.NewReader([]byte(`{`)))
		require.Error(t, CheckVolumeBodyRestrictions(req))
	})
}

func TestREQ_VOL_01_GetVolumeResourceIDAndDockerIDCache(t *testing.T) {
	t.Parallel()

	transport := &Transport{dockerID: "docker-abc"}

	id, err := transport.getVolumeResourceID("myvol")
	require.NoError(t, err)
	require.Equal(t, "myvol_docker-abc", id)

	cached, err := transport.getDockerID()
	require.NoError(t, err)
	require.Equal(t, "docker-abc", cached)
}

func TestREQ_VOL_01_DecorateVolumeResponseWithResourceID(t *testing.T) {
	t.Parallel()

	transport := &Transport{dockerID: "node-1"}

	t.Run("missing name", func(t *testing.T) {
		t.Parallel()
		err := transport.decorateVolumeResponseWithResourceID(map[string]any{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing identifier")
	})

	t.Run("sets ResourceID", func(t *testing.T) {
		t.Parallel()
		obj := map[string]any{"Name": "data"}
		require.NoError(t, transport.decorateVolumeResponseWithResourceID(obj))
		require.Equal(t, "data_node-1", obj[volumeObjectIdentifier])
	})
}

func TestREQ_VOL_01_VolumeListOperation(t *testing.T) {
	t.Parallel()

	executor := &operationExecutor{
		operationContext: &restrictedDockerOperationContext{isAdmin: true},
	}
	transport := &Transport{dockerID: "docker-xyz", endpoint: &portainer.Endpoint{ID: 1}}

	t.Run("nil volumes field", func(t *testing.T) {
		t.Parallel()
		resp := jsonHTTPResponse(t, http.StatusOK, map[string]any{"Warnings": nil})
		require.NoError(t, transport.volumeListOperation(resp, executor))
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var decoded map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
		require.NoError(t, resp.Body.Close())
		require.Nil(t, decoded["Volumes"])
	})

	t.Run("decorates volume list for admin", func(t *testing.T) {
		t.Parallel()
		resp := jsonHTTPResponse(t, http.StatusOK, map[string]any{
			"Volumes": []any{
				map[string]any{
					"Name":   "vol-a",
					"Driver": "local",
					"Labels": map[string]any{"env": "dev"},
				},
			},
		})
		require.NoError(t, transport.volumeListOperation(resp, executor))

		var decoded map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
		require.NoError(t, resp.Body.Close())

		volumes, ok := decoded["Volumes"].([]any)
		require.True(t, ok)
		require.Len(t, volumes, 1)
		vol := volumes[0].(map[string]any)
		require.Equal(t, "vol-a_docker-xyz", vol[volumeObjectIdentifier])
	})
}

func TestREQ_VOL_03_VolumeInspectOperation(t *testing.T) {
	t.Parallel()

	transport := &Transport{dockerID: "docker-xyz", endpoint: &portainer.Endpoint{ID: 1}}
	executor := &operationExecutor{
		operationContext: &restrictedDockerOperationContext{isAdmin: true},
	}

	resp := jsonHTTPResponse(t, http.StatusOK, map[string]any{
		"Name":       "vol-b",
		"Driver":     "local",
		"Mountpoint": "/var/lib/docker/volumes/vol-b/_data",
		"Labels":     map[string]any{},
	})
	require.NoError(t, transport.volumeInspectOperation(resp, executor))
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var decoded map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
	require.NoError(t, resp.Body.Close())
	require.Equal(t, "vol-b_docker-xyz", decoded[volumeObjectIdentifier])
}

func TestREQ_VOL_03_VolumeInspectDeniedForNonAdminWithoutRC(t *testing.T) {
	t.Parallel()

	transport := &Transport{dockerID: "docker-xyz", endpoint: &portainer.Endpoint{ID: 1}}
	executor := &operationExecutor{
		operationContext: &restrictedDockerOperationContext{
			isAdmin:          false,
			userID:           9,
			resourceControls: nil,
		},
	}

	resp := jsonHTTPResponse(t, http.StatusOK, map[string]any{
		"Name":   "secret-vol",
		"Driver": "local",
		"Labels": map[string]any{},
	})
	require.NoError(t, transport.volumeInspectOperation(resp, executor))
	require.Equal(t, http.StatusForbidden, resp.StatusCode)
	require.NoError(t, resp.Body.Close())
}

func TestREQ_VOL_02_DecorateVolumeCreationResponse(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	transport := &Transport{
		dockerID:  "docker-create",
		dataStore: store,
		endpoint:  &portainer.Endpoint{ID: 1},
	}

	t.Run("missing name", func(t *testing.T) {
		t.Parallel()
		resp := jsonHTTPResponse(t, http.StatusCreated, map[string]any{"Driver": "local"})
		err := transport.decorateVolumeCreationResponse(resp, portainer.VolumeResourceControl, 1)
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing identifier")
		require.NoError(t, resp.Body.Close())
	})

	t.Run("creates private resource control", func(t *testing.T) {
		t.Parallel()
		resp := jsonHTTPResponse(t, http.StatusCreated, map[string]any{"Name": "created-vol", "Driver": "local"})
		require.NoError(t, transport.decorateVolumeCreationResponse(resp, portainer.VolumeResourceControl, 42))

		var decoded map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
		require.NoError(t, resp.Body.Close())
		require.Equal(t, "created-vol_docker-create", decoded[volumeObjectIdentifier])
		require.NotNil(t, decoded["Portainer"])
	})
}

func TestREQ_VOL_01_ProxyVolumeListAndInspect(t *testing.T) {
	t.Parallel()

	admin := portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	std := portainer.User{ID: 2, Username: "std", Role: portainer.StandardUserRole}

	_, ds := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, ds.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&admin))
		require.NoError(t, tx.User().Create(&std))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{ID: 1, Name: "env"}))
		require.NoError(t, tx.ResourceControl().Create(
			authorization.NewPrivateResourceControl("owned_docker-vol", portainer.VolumeResourceControl, std.ID),
		))
		return nil
	}))

	volPayload := volume.Volume{Name: "owned", Driver: "local", Labels: map[string]string{}}
	srv, version := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodGet, "/volumes"}: volume.ListResponse{
			Volumes: []*volume.Volume{&volPayload},
		},
		{http.MethodGet, "/volumes/owned"}: volPayload,
	})
	t.Cleanup(srv.Close)

	transport := &Transport{
		endpoint:      &portainer.Endpoint{ID: 1, URL: srv.URL},
		dataStore:     ds,
		HTTPTransport: &http.Transport{},
		dockerID:      "docker-vol",
	}

	call := func(method, path string, user portainer.User) *http.Response {
		t.Helper()
		req := httptest.NewRequest(method, srv.URL+"/v"+version+path, nil)
		req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
			ID: user.ID, Username: user.Username, Role: user.Role,
		}))
		resp, err := transport.proxyVolumeRequest(req, path)
		require.NoError(t, err)
		require.NotNil(t, resp)
		return resp
	}

	{
		resp := call(http.MethodGet, "/volumes", admin)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		var decoded map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
		require.NoError(t, resp.Body.Close())
		vols := decoded["Volumes"].([]any)
		require.Len(t, vols, 1)
		require.Equal(t, "owned_docker-vol", vols[0].(map[string]any)[volumeObjectIdentifier])
	}

	{
		resp := call(http.MethodGet, "/volumes", std)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		var decoded map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
		require.NoError(t, resp.Body.Close())
		vols := decoded["Volumes"].([]any)
		require.Len(t, vols, 1)
	}

	{
		resp := call(http.MethodGet, "/volumes/owned", admin)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		var decoded map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
		require.NoError(t, resp.Body.Close())
		require.Equal(t, "owned_docker-vol", decoded[volumeObjectIdentifier])
	}

	{
		resp := call(http.MethodGet, "/volumes/owned", std)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	}
}

func TestREQ_VOL_05_RestrictedVolumeOperationDeleteUnauthorized(t *testing.T) {
	t.Parallel()

	admin := portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	std := portainer.User{ID: 2, Username: "std", Role: portainer.StandardUserRole}

	_, ds := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, ds.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&admin))
		require.NoError(t, tx.User().Create(&std))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{ID: 1, Name: "env"}))
		// Private to admin so a standard user is denied without hitting Docker inherit lookup.
		require.NoError(t, tx.ResourceControl().Create(
			authorization.NewPrivateResourceControl("orphan_docker-vol", portainer.VolumeResourceControl, admin.ID),
		))
		return nil
	}))

	srv, version := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodDelete, "/volumes/orphan"}: map[string]any{},
	})
	t.Cleanup(srv.Close)

	transport := &Transport{
		endpoint:      &portainer.Endpoint{ID: 1, URL: srv.URL},
		dataStore:     ds,
		HTTPTransport: &http.Transport{},
		dockerID:      "docker-vol",
	}

	req := httptest.NewRequest(http.MethodDelete, srv.URL+"/v"+version+"/volumes/orphan", nil)
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
		ID: std.ID, Username: std.Username, Role: std.Role,
	}))
	resp, err := transport.proxyVolumeRequest(req, "/volumes/orphan")
	require.NoError(t, err)
	require.NotNil(t, resp)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)
	require.NoError(t, resp.Body.Close())
}
