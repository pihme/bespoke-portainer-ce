package docker

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	portainer "github.com/portainer/portainer/api"
	dockerclient "github.com/portainer/portainer/api/docker/client"
	"github.com/portainer/portainer/api/docker/consts"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/authorization"
	"github.com/portainer/portainer/api/stacks/stackutils"

	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)


func dockerCreateServer(t *testing.T, createPath string, createBody any) *httptest.Server {
	t.Helper()
	data, err := json.Marshal(createBody)
	require.NoError(t, err)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead && r.URL.Path == "/_ping" {
			w.Header().Add("Api-Version", "1.51")
			return
		}
		if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, createPath) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write(data)
			return
		}
		http.NotFound(w, r)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestREQ_HOST_04_ContainerCreationSecurityRestrictions(t *testing.T) {
	t.Parallel()

	admin := portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	std := portainer.User{ID: 2, Username: "std", Role: portainer.StandardUserRole}

	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&admin))
		require.NoError(t, tx.User().Create(&std))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{
			ID:   1,
			Name: "env",
			SecuritySettings: portainer.EndpointSecuritySettings{
				AllowPrivilegedModeForRegularUsers:        false,
				AllowHostNamespaceForRegularUsers:         false,
				AllowDeviceMappingForRegularUsers:         false,
				AllowSysctlSettingForRegularUsers:         false,
				AllowSecurityOptForRegularUsers:           false,
				AllowContainerCapabilitiesForRegularUsers: false,
				AllowBindMountsForRegularUsers:            true, // isolate non-bind checks
			},
		}))
		return nil
	}))

	srv := dockerCreateServer(t, "/containers/create", map[string]any{"Id": "new-ctr", "Warnings": []any{}})

	transport := &Transport{
		endpoint:      &portainer.Endpoint{ID: 1, URL: srv.URL},
		dataStore:     store,
		HTTPTransport: &http.Transport{},
	}

	makeReq := func(user portainer.User, body any) *http.Request {
		t.Helper()
		data, err := json.Marshal(body)
		require.NoError(t, err)
		req := httptest.NewRequest(http.MethodPost, srv.URL+"/v1.51/containers/create", bytes.NewReader(data))
		return req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
			ID: user.ID, Username: user.Username, Role: user.Role,
		}))
	}

	cases := []struct {
		name string
		body map[string]any
		err  error
	}{
		{
			name: "privileged",
			body: map[string]any{"HostConfig": map[string]any{"Privileged": true}},
			err:  ErrPrivilegedModeForbidden,
		},
		{
			name: "pid host",
			body: map[string]any{"HostConfig": map[string]any{"PidMode": "host"}},
			err:  ErrPIDHostNamespaceForbidden,
		},
		{
			name: "devices",
			body: map[string]any{"HostConfig": map[string]any{"Devices": []any{map[string]any{"PathOnHost": "/dev/null"}}}},
			err:  ErrDeviceMappingForbidden,
		},
		{
			name: "sysctl",
			body: map[string]any{"HostConfig": map[string]any{"Sysctls": map[string]any{"net.ipv4.ip_forward": "1"}}},
			err:  ErrSysCtlSettingsForbidden,
		},
		{
			name: "security opt",
			body: map[string]any{"HostConfig": map[string]any{"SecurityOpt": []string{"label=disable"}}},
			err:  ErrSecurityOptSettingsForbidden,
		},
		{
			name: "capabilities",
			body: map[string]any{"HostConfig": map[string]any{"CapAdd": []string{"NET_ADMIN"}}},
			err:  ErrContainerCapabilitiesForbidden,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			resp, err := transport.decorateContainerCreationOperation(makeReq(std, tc.body), containerObjectIdentifier, portainer.ContainerResourceControl)
			require.ErrorIs(t, err, tc.err)
			if tc.err != ErrContainerCapabilitiesForbidden {
				require.NotNil(t, resp)
				require.Equal(t, http.StatusForbidden, resp.StatusCode)
			}
		})
	}

	t.Run("admin bypasses privileged", func(t *testing.T) {
		t.Parallel()
		resp, err := transport.decorateContainerCreationOperation(makeReq(admin, map[string]any{
			"HostConfig": map[string]any{"Privileged": true},
		}), containerObjectIdentifier, portainer.ContainerResourceControl)
		require.NoError(t, err)
		require.Equal(t, http.StatusCreated, resp.StatusCode)
		var adminDecoded map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&adminDecoded))
		require.NoError(t, resp.Body.Close())
		require.NotNil(t, adminDecoded["Portainer"])
	})

	t.Run("std allowed body creates private RC", func(t *testing.T) {
		t.Parallel()
		resp, err := transport.decorateContainerCreationOperation(makeReq(std, map[string]any{
			"Image":      "nginx",
			"HostConfig": map[string]any{},
		}), containerObjectIdentifier, portainer.ContainerResourceControl)
		require.NoError(t, err)
		require.Equal(t, http.StatusCreated, resp.StatusCode)
		var decoded map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
		require.NoError(t, resp.Body.Close())
		require.Equal(t, "new-ctr", decoded["Id"])
		require.NotNil(t, decoded["Portainer"])
	})
}

func TestREQ_VOL_02_VolumeCreateExistenceCheck(t *testing.T) {
	t.Parallel()

	admin := portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&admin))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{ID: 1, Name: "env"}))
		return nil
	}))

	t.Run("conflict when volume already exists", func(t *testing.T) {
		t.Parallel()
		srv, version := mockDockerAPIServer(t, RoutesDefinition{
			{http.MethodGet, "/volumes/existing"}: volume.Volume{Name: "existing", Driver: "local"},
			{http.MethodPost, "/volumes/create"}:  map[string]any{"Name": "existing"},
		})
		t.Cleanup(srv.Close)

		transport := &Transport{
			endpoint:            &portainer.Endpoint{ID: 1, URL: srv.URL},
			dataStore:           store,
			HTTPTransport:       &http.Transport{},
			dockerClientFactory: dockerclient.NewClientFactory(nil, nil),
			dockerID:            "engine-1",
		}

		body := []byte(`{"Name":"existing","Driver":"local"}`)
		req := httptest.NewRequest(http.MethodPost, srv.URL+"/v"+version+"/volumes/create", bytes.NewReader(body))
		req.Header.Set("X-Portainer-VolumeName", "existing")
		req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
			ID: admin.ID, Username: admin.Username, Role: admin.Role,
		}))

		resp, err := transport.decorateVolumeResourceCreationOperation(req, portainer.VolumeResourceControl)
		require.Error(t, err)
		require.Contains(t, err.Error(), "already exists")
		require.NotNil(t, resp)
		require.Equal(t, http.StatusConflict, resp.StatusCode)
	})

	t.Run("creates when name header set but volume missing", func(t *testing.T) {
		t.Parallel()
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodHead && r.URL.Path == "/_ping" {
				w.Header().Add("Api-Version", "1.51")
				return
			}
			if r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/volumes/fresh") {
				http.NotFound(w, r)
				return
			}
			if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/volumes/create") {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusCreated)
				_, _ = w.Write([]byte(`{"Name":"fresh","Driver":"local"}`))
				return
			}
			http.NotFound(w, r)
		}))
		t.Cleanup(srv.Close)

		transport := &Transport{
			endpoint:            &portainer.Endpoint{ID: 1, URL: srv.URL},
			dataStore:           store,
			HTTPTransport:       &http.Transport{},
			dockerClientFactory: dockerclient.NewClientFactory(nil, nil),
			dockerID:            "engine-1",
		}

		body := []byte(`{"Name":"fresh","Driver":"local"}`)
		req := httptest.NewRequest(http.MethodPost, srv.URL+"/v1.51/volumes/create", bytes.NewReader(body))
		req.Header.Set("X-Portainer-VolumeName", "fresh")
		req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
			ID: admin.ID, Username: admin.Username, Role: admin.Role,
		}))

		resp, err := transport.decorateVolumeResourceCreationOperation(req, portainer.VolumeResourceControl)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode) // decorateVolumeCreationResponse rewrites to 200
		var decoded map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
		require.NoError(t, resp.Body.Close())
		require.Equal(t, "fresh_engine-1", decoded[volumeObjectIdentifier])
		require.NotNil(t, decoded["Portainer"])
	})
}

func TestREQ_USR_08_RestrictedResourceOperationLocal(t *testing.T) {
	t.Parallel()

	admin := portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	owner := portainer.User{ID: 2, Username: "owner", Role: portainer.StandardUserRole}
	other := portainer.User{ID: 3, Username: "other", Role: portainer.StandardUserRole}

	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&admin))
		require.NoError(t, tx.User().Create(&owner))
		require.NoError(t, tx.User().Create(&other))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{
			ID: 1, Name: "env",
			SecuritySettings: portainer.EndpointSecuritySettings{
				AllowVolumeBrowserForRegularUsers: false,
			},
		}))
		require.NoError(t, tx.ResourceControl().Create(
			authorization.NewPrivateResourceControl("ctr-owned", portainer.ContainerResourceControl, owner.ID),
		))
		require.NoError(t, tx.ResourceControl().Create(
			authorization.NewPrivateResourceControl("nid-owned", portainer.NetworkResourceControl, owner.ID),
		))
		stackID := stackutils.ResourceControlID(1, "stack-a")
		require.NoError(t, tx.ResourceControl().Create(
			authorization.NewPrivateResourceControl(stackID, portainer.StackResourceControl, owner.ID),
		))
		return nil
	}))

	srv, version := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodPost, "/containers/ctr-owned/start"}:    map[string]any{},
		{http.MethodPost, "/containers/ctr-inherited/start"}: map[string]any{},
		{http.MethodGet, "/containers/ctr-inherited/json"}: map[string]any{
			"Id": "ctr-inherited",
			"Config": map[string]any{
				"Labels": map[string]string{
					consts.ComposeStackNameLabel: "stack-a",
				},
			},
		},
		{http.MethodPost, "/networks/nid-owned/connect"}: map[string]any{},
		{http.MethodGet, "/networks/custom"}: network.Inspect{
			ID:   "nid-owned",
			Name: "custom",
		},
		{http.MethodPost, "/networks/custom/connect"}: map[string]any{},
	})
	t.Cleanup(srv.Close)

	transport := &Transport{
		endpoint:            &portainer.Endpoint{ID: 1, URL: srv.URL},
		dataStore:           store,
		HTTPTransport:       &http.Transport{},
		dockerClientFactory: dockerclient.NewClientFactory(nil, nil),
	}

	tokenReq := func(method, path string, user portainer.User) *http.Request {
		t.Helper()
		req := httptest.NewRequest(method, srv.URL+"/v"+version+path, nil)
		return req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
			ID: user.ID, Username: user.Username, Role: user.Role,
		}))
	}

	t.Run("admin bypass", func(t *testing.T) {
		t.Parallel()
		resp, err := transport.restrictedResourceOperation(
			tokenReq(http.MethodPost, "/containers/ctr-owned/start", admin),
			"ctr-owned", "ctr-owned", portainer.ContainerResourceControl, false,
		)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	})

	t.Run("owner allowed", func(t *testing.T) {
		t.Parallel()
		resp, err := transport.restrictedResourceOperation(
			tokenReq(http.MethodPost, "/containers/ctr-owned/start", owner),
			"ctr-owned", "ctr-owned", portainer.ContainerResourceControl, false,
		)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	})

	t.Run("non-owner denied", func(t *testing.T) {
		t.Parallel()
		resp, err := transport.restrictedResourceOperation(
			tokenReq(http.MethodPost, "/containers/ctr-owned/start", other),
			"ctr-owned", "ctr-owned", portainer.ContainerResourceControl, false,
		)
		require.NoError(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	})

	t.Run("inherited compose stack allows owner", func(t *testing.T) {
		t.Parallel()
		resp, err := transport.restrictedResourceOperation(
			tokenReq(http.MethodPost, "/containers/ctr-inherited/start", owner),
			"ctr-inherited", "ctr-inherited", portainer.ContainerResourceControl, false,
		)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	})

	t.Run("network name resolves to uuid RC", func(t *testing.T) {
		t.Parallel()
		resp, err := transport.restrictedResourceOperation(
			tokenReq(http.MethodPost, "/networks/custom/connect", owner),
			"custom", "custom", portainer.NetworkResourceControl, false,
		)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	})

	t.Run("volume browse denied for regular users", func(t *testing.T) {
		t.Parallel()
		resp, err := transport.restrictedResourceOperation(
			tokenReq(http.MethodGet, "/unused", owner),
			"vol_engine", "vol", portainer.VolumeResourceControl, true,
		)
		require.NoError(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	})
}

func TestREQ_VOL_04_RestrictedResourceOperationVolumeBrowseAllowed(t *testing.T) {
	t.Parallel()

	owner := portainer.User{ID: 2, Username: "owner", Role: portainer.StandardUserRole}
	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&owner))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{
			ID: 1, Name: "env",
			SecuritySettings: portainer.EndpointSecuritySettings{
				AllowVolumeBrowserForRegularUsers: true,
			},
		}))
		require.NoError(t, tx.ResourceControl().Create(
			authorization.NewPrivateResourceControl("data_engine", portainer.VolumeResourceControl, owner.ID),
		))
		return nil
	}))

	srv, version := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodGet, "/browse"}: map[string]any{"files": []any{}},
	})
	t.Cleanup(srv.Close)

	transport := &Transport{
		endpoint:      &portainer.Endpoint{ID: 1, URL: srv.URL},
		dataStore:     store,
		HTTPTransport: &http.Transport{},
	}

	req := httptest.NewRequest(http.MethodGet, srv.URL+"/v"+version+"/browse", nil)
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
		ID: owner.ID, Username: owner.Username, Role: owner.Role,
	}))
	resp, err := transport.restrictedResourceOperation(req, "data_engine", "data", portainer.VolumeResourceControl, true)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.NoError(t, resp.Body.Close())
}

func TestREQ_IMG_03_BuildOperationLocalDockerfileBodies(t *testing.T) {
	t.Parallel()

	t.Run("empty content type tars uploaded dockerfile", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodPost, "/build", strings.NewReader("FROM scratch\n"))
		// intentionally no Content-Type
		require.NoError(t, buildOperation(req))
		require.Equal(t, "application/x-tar", req.Header.Get("Content-Type"))
		require.Greater(t, req.ContentLength, int64(0))
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		require.NotEmpty(t, body)
	})

	t.Run("application/json wraps content", func(t *testing.T) {
		t.Parallel()
		payload, err := json.Marshal(map[string]string{"Content": "FROM alpine\n"})
		require.NoError(t, err)
		req := httptest.NewRequest(http.MethodPost, "/build", bytes.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		require.NoError(t, buildOperation(req))
		require.Equal(t, "application/x-tar", req.Header.Get("Content-Type"))
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)
		require.NotEmpty(t, body)
	})

	t.Run("unaltered content types pass through", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodPost, "/build", strings.NewReader("raw-tar"))
		req.Header.Set("Content-Type", "application/x-tar")
		require.NoError(t, buildOperation(req))
		require.Equal(t, "application/x-tar", req.Header.Get("Content-Type"))
	})

}

func TestREQ_IMG_03_InterceptAndRewriteRequestViaProxyBuild(t *testing.T) {
	t.Parallel()

	admin := portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&admin))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{ID: 1, Name: "env"}))
		return nil
	}))

	var sawContentType string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead && r.URL.Path == "/_ping" {
			w.Header().Add("Api-Version", "1.51")
			return
		}
		sawContentType = r.Header.Get("Content-Type")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"stream":"Step 1/1 : FROM scratch\n"}`))
	}))
	t.Cleanup(srv.Close)

	transport := &Transport{
		endpoint:      &portainer.Endpoint{ID: 1, URL: srv.URL},
		dataStore:     store,
		HTTPTransport: &http.Transport{},
	}

	payload, err := json.Marshal(map[string]string{"Content": "FROM scratch\n"})
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, srv.URL+"/v1.51/build", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
		ID: admin.ID, Username: admin.Username, Role: admin.Role,
	}))

	resp, err := transport.proxyBuildRequest(req, "/build")
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.NoError(t, resp.Body.Close())
	require.Equal(t, "application/x-tar", sawContentType)
}

func TestREQ_USR_08_CreatePrivateResourceControlAndGenericCreation(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	transport := &Transport{
		endpoint:  &portainer.Endpoint{ID: 1},
		dataStore: store,
	}

	t.Run("createPrivate success", func(t *testing.T) {
		t.Parallel()
		rc, err := transport.createPrivateResourceControl("net-1", portainer.NetworkResourceControl, 9)
		require.NoError(t, err)
		require.Equal(t, "net-1", rc.ResourceID)
		require.Equal(t, portainer.UserID(9), rc.UserAccesses[0].UserID)
	})

	t.Run("decorateGenericResourceCreationResponse missing id", func(t *testing.T) {
		t.Parallel()
		resp := jsonHTTPResponse(t, http.StatusCreated, map[string]any{"Warnings": []any{}})
		err := transport.decorateGenericResourceCreationResponse(resp, "Id", portainer.ContainerResourceControl, 1)
		require.Error(t, err)
		require.Contains(t, err.Error(), "missing identifier")
		require.NoError(t, resp.Body.Close())
	})

	t.Run("decorateGenericResourceCreationOperation on network create", func(t *testing.T) {
		t.Parallel()
		admin := portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
		require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
			_ = tx.User().Create(&admin)
			return nil
		}))

		srv := dockerCreateServer(t, "/networks/create", map[string]any{"Id": "brand-new-net", "Warning": ""})
		tr := &Transport{
			endpoint:      &portainer.Endpoint{ID: 1, URL: srv.URL},
			dataStore:     store,
			HTTPTransport: &http.Transport{},
		}
		req := httptest.NewRequest(http.MethodPost, srv.URL+"/v1.51/networks/create", strings.NewReader(`{"Name":"n1"}`))
		req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
			ID: admin.ID, Username: admin.Username, Role: admin.Role,
		}))
		resp, err := tr.decorateGenericResourceCreationOperation(req, networkObjectIdentifier, portainer.NetworkResourceControl)
		require.NoError(t, err)
		require.Equal(t, http.StatusCreated, resp.StatusCode)
		var decoded map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
		require.NoError(t, resp.Body.Close())
		require.NotNil(t, decoded["Portainer"])
	})
}

func TestREQ_NET_03_NetworkInspectSystemAndAccess(t *testing.T) {
	t.Parallel()

	transport := &Transport{endpoint: &portainer.Endpoint{ID: 1}}

	t.Run("system network decorated for non-admin", func(t *testing.T) {
		t.Parallel()
		executor := &operationExecutor{
			operationContext: &restrictedDockerOperationContext{isAdmin: false, userID: 2},
		}
		resp := jsonHTTPResponse(t, http.StatusOK, map[string]any{
			"Id": "sys-bridge", "Name": "bridge", "Labels": map[string]any{},
		})
		require.NoError(t, transport.networkInspectOperation(resp, executor))
		require.Equal(t, http.StatusOK, resp.StatusCode)
		var decoded map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
		require.NoError(t, resp.Body.Close())
		require.NotNil(t, decoded["Portainer"])
	})

	t.Run("non-system denied without RC", func(t *testing.T) {
		t.Parallel()
		executor := &operationExecutor{
			operationContext: &restrictedDockerOperationContext{isAdmin: false, userID: 2},
		}
		resp := jsonHTTPResponse(t, http.StatusOK, map[string]any{
			"Id": "custom", "Name": "custom", "Labels": map[string]any{},
		})
		require.NoError(t, transport.networkInspectOperation(resp, executor))
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	})
}

func TestREQ_CTR_01_ApplyAccessControlMissingIdentifier(t *testing.T) {
	t.Parallel()

	transport := &Transport{endpoint: &portainer.Endpoint{ID: 1}}
	executor := &operationExecutor{
		operationContext: &restrictedDockerOperationContext{isAdmin: true},
	}
	params := &resourceOperationParameters{
		resourceIdentifierAttribute: containerObjectIdentifier,
		resourceType:                portainer.ContainerResourceControl,
		labelsObjectSelector:        selectorContainerLabelsFromContainerListOperation,
	}

	resp := jsonHTTPResponse(t, http.StatusOK, map[string]any{"Names": []any{"/x"}})
	// Missing Id: applyAccessControlOnResource returns nil without rewrite error
	require.NoError(t, transport.applyAccessControlOnResource(params, map[string]any{"Names": []any{"/x"}}, resp, executor))
	require.NoError(t, resp.Body.Close())
}

func TestREQ_VOL_01_FilterResourceListSkipsMissingIdentifier(t *testing.T) {
	t.Parallel()

	transport := &Transport{dockerID: "d1", endpoint: &portainer.Endpoint{ID: 1}}
	executor := &operationExecutor{
		operationContext: &restrictedDockerOperationContext{
			isAdmin: false,
			userID:  2,
			resourceControls: []portainer.ResourceControl{
				*authorization.NewPrivateResourceControl("keep_d1", portainer.VolumeResourceControl, 2),
			},
		},
	}
	resp := jsonHTTPResponse(t, http.StatusOK, map[string]any{
		"Volumes": []any{
			map[string]any{"Driver": "local"}, // missing Name → decorate fails before filter? decorateVolume needs Name
		},
	})
	// volumeListOperation will error on missing Name during decorateVolumeResponseWithResourceID
	err := transport.volumeListOperation(resp, executor)
	require.Error(t, err)
	require.NoError(t, resp.Body.Close())
}

func TestREQ_HOST_04_ContainerCreationVolumesFromForbidden(t *testing.T) {
	t.Parallel()

	std := portainer.User{ID: 2, Username: "std", Role: portainer.StandardUserRole}
	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}))
		require.NoError(t, tx.User().Create(&std))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{
			ID: 1, Name: "env",
			SecuritySettings: portainer.EndpointSecuritySettings{
				AllowBindMountsForRegularUsers: false,
			},
		}))
		return nil
	}))

	srv := dockerCreateServer(t, "/containers/create", map[string]any{"Id": "x"})
	transport := &Transport{
		endpoint:      &portainer.Endpoint{ID: 1, URL: srv.URL},
		dataStore:     store,
		HTTPTransport: &http.Transport{},
	}

	body, err := json.Marshal(map[string]any{
		"HostConfig": map[string]any{"VolumesFrom": []string{"other:rw"}},
	})
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, srv.URL+"/v1.51/containers/create", bytes.NewReader(body))
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
		ID: std.ID, Username: std.Username, Role: std.Role,
	}))
	resp, err := transport.decorateContainerCreationOperation(req, containerObjectIdentifier, portainer.ContainerResourceControl)
	require.ErrorIs(t, err, ErrBindMountsForbidden)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func TestREQ_CTR_02_ProxyContainerUpdate(t *testing.T) {
	t.Parallel()

	admin := portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	std := portainer.User{ID: 2, Username: "std", Role: portainer.StandardUserRole}
	const containerID = "upd-1"

	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&admin))
		require.NoError(t, tx.User().Create(&std))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{
			ID: 1, Name: "env",
			SecuritySettings: portainer.EndpointSecuritySettings{
				AllowDeviceMappingForRegularUsers: false,
			},
		}))
		require.NoError(t, tx.ResourceControl().Create(
			authorization.NewPrivateResourceControl(containerID, portainer.ContainerResourceControl, std.ID),
		))
		return nil
	}))

	srv, version := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodPost, "/containers/" + containerID + "/update"}: map[string]any{"Warnings": []string{}},
	})
	t.Cleanup(srv.Close)

	transport := &Transport{
		endpoint:      &portainer.Endpoint{ID: 1, URL: srv.URL},
		dataStore:     store,
		HTTPTransport: &http.Transport{},
	}

	body, err := json.Marshal(map[string]any{"Devices": []any{}})
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, srv.URL+"/v"+version+"/containers/"+containerID+"/update", bytes.NewReader(body))
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
		ID: std.ID, Username: std.Username, Role: std.Role,
	}))
	resp, err := transport.proxyContainerRequest(req, "/containers/"+containerID+"/update")
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.NoError(t, resp.Body.Close())
}

func TestREQ_USR_08_RestrictedResourceInheritedDeniedAndEmptyDockerID(t *testing.T) {
	t.Parallel()

	owner := portainer.User{ID: 2, Username: "owner", Role: portainer.StandardUserRole}
	other := portainer.User{ID: 3, Username: "other", Role: portainer.StandardUserRole}
	_, store := datastore.MustNewTestStore(t, true, false)
	stackID := stackutils.ResourceControlID(1, "stack-b")
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&owner))
		require.NoError(t, tx.User().Create(&other))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{ID: 1, Name: "env"}))
		require.NoError(t, tx.ResourceControl().Create(
			authorization.NewPrivateResourceControl(stackID, portainer.StackResourceControl, owner.ID),
		))
		return nil
	}))

	srv, version := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodPost, "/containers/c-inh/start"}: map[string]any{},
		{http.MethodGet, "/containers/c-inh/json"}: map[string]any{
			"Id": "c-inh",
			"Config": map[string]any{
				"Labels": map[string]string{consts.ComposeStackNameLabel: "stack-b"},
			},
		},
	})
	t.Cleanup(srv.Close)

	transport := &Transport{
		endpoint:            &portainer.Endpoint{ID: 1, URL: srv.URL},
		dataStore:           store,
		HTTPTransport:       &http.Transport{},
		dockerClientFactory: dockerclient.NewClientFactory(nil, nil),
	}

	req := httptest.NewRequest(http.MethodPost, srv.URL+"/v"+version+"/containers/c-inh/start", nil)
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
		ID: other.ID, Username: other.Username, Role: other.Role,
	}))
	resp, err := transport.restrictedResourceOperation(req, "c-inh", "", portainer.ContainerResourceControl, false)
	require.NoError(t, err)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)
	require.NoError(t, resp.Body.Close())
}

func TestREQ_IMG_03_InterceptAndRewriteRequestOperationError(t *testing.T) {
	t.Parallel()

	transport := &Transport{HTTPTransport: &http.Transport{}}
	req := httptest.NewRequest(http.MethodPost, "http://example.invalid/build", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json; charset=invalid@@@")
	// invalid media type parameters may still parse; use completely invalid type token
	req.Header.Set("Content-Type", "application/")
	resp, err := transport.interceptAndRewriteRequest(req, buildOperation)
	require.Error(t, err)
	require.Nil(t, resp)
}

func TestREQ_NET_01_FilterResourceListSystemNetworkForNonAdmin(t *testing.T) {
	t.Parallel()

	ownerRC := authorization.NewPrivateResourceControl("owned-net", portainer.NetworkResourceControl, 2)
	transport := &Transport{endpoint: &portainer.Endpoint{ID: 1}}
	executor := &operationExecutor{
		operationContext: &restrictedDockerOperationContext{
			isAdmin:          false,
			userID:           2,
			resourceControls: []portainer.ResourceControl{*ownerRC},
		},
	}

	data, err := json.Marshal([]any{
		map[string]any{"Id": "b1", "Name": "bridge", "Labels": map[string]any{}},
		map[string]any{"Id": "owned-net", "Name": "mine", "Labels": map[string]any{}},
		map[string]any{"Id": "other", "Name": "other", "Labels": map[string]any{}},
		map[string]any{"Name": "broken"}, // missing Id
	})
	require.NoError(t, err)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(data)),
	}
	require.NoError(t, transport.networkListOperation(resp, executor))

	var decoded []any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
	require.NoError(t, resp.Body.Close())
	require.Len(t, decoded, 2)
	names := []string{
		decoded[0].(map[string]any)["Name"].(string),
		decoded[1].(map[string]any)["Name"].(string),
	}
	assert.ElementsMatch(t, []string{"bridge", "mine"}, names)
}

func TestREQ_CTR_01_ApplyPortainerContainerFlag(t *testing.T) {
	t.Parallel()

	transport := &Transport{}
	// Production compares resourceId[0:12] == portainerContainerId, so the
	// hostname-derived id must be exactly 12 characters for a positive hit.
	if len(portainerContainerId) == 12 {
		obj, err := transport.applyPortainerContainer(map[string]any{"Id": portainerContainerId + "abcdef"})
		require.NoError(t, err)
		require.Equal(t, true, obj["IsPortainer"])
	}

	obj, err := transport.applyPortainerContainer(map[string]any{"Id": "notportainer"})
	require.NoError(t, err)
	_, ok := obj["IsPortainer"]
	require.False(t, ok)

	obj, err = transport.applyPortainerContainer(map[string]any{"Name": "x"})
	require.NoError(t, err)
	require.Equal(t, "x", obj["Name"])
}

func TestREQ_VOL_05_AdminDeleteVolumeRemovesResourceControl(t *testing.T) {
	t.Parallel()

	admin := portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&admin))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{ID: 1, Name: "env"}))
		require.NoError(t, tx.ResourceControl().Create(
			authorization.NewPrivateResourceControl("gone_docker-del", portainer.VolumeResourceControl, admin.ID),
		))
		return nil
	}))

	srv, version := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodDelete, "/volumes/gone"}: map[string]any{},
	})
	t.Cleanup(srv.Close)

	transport := &Transport{
		endpoint:      &portainer.Endpoint{ID: 1, URL: srv.URL},
		dataStore:     store,
		HTTPTransport: &http.Transport{},
		dockerID:      "docker-del",
	}

	req := httptest.NewRequest(http.MethodDelete, srv.URL+"/v"+version+"/volumes/gone", nil)
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
		ID: admin.ID, Username: admin.Username, Role: admin.Role,
	}))
	resp, err := transport.proxyVolumeRequest(req, "/volumes/gone")
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.NoError(t, resp.Body.Close())

	rc, err := store.ResourceControl().ResourceControlByResourceIDAndType("gone_docker-del", portainer.VolumeResourceControl)
	require.NoError(t, err)
	require.Nil(t, rc)
}

func TestREQ_CTR_03_ReferencedVolumeNames(t *testing.T) {
	t.Parallel()

	names := referencedVolumeNames(
		[]string{"/host:/data", "myvol:/app", ":"},
		[]PartialMount{
			{Type: "bind", Source: "/etc"},
			{Type: "volume", Source: "vol2"},
			{Type: "volume", Source: ""},
		},
	)
	require.Equal(t, []string{"myvol", "vol2"}, names)
}

func TestREQ_IMG_03_BuildOperationSmallMultipart(t *testing.T) {
	t.Parallel()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("Dockerfile", "Dockerfile")
	require.NoError(t, err)
	_, err = part.Write([]byte("FROM scratch\n"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	req := httptest.NewRequest(http.MethodPost, "/build", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	require.NoError(t, buildOperation(req))
	require.Equal(t, "application/x-tar", req.Header.Get("Content-Type"))
	data, err := io.ReadAll(req.Body)
	require.NoError(t, err)
	require.NotEmpty(t, data)
}
