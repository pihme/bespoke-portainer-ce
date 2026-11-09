package docker

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
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
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/api/types/system"
	"github.com/docker/docker/api/types/volume"
	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/require"
)

type stubSnapshotService struct {
	snapshots []portainer.DockerSnapshot
	err       error
}

func (s *stubSnapshotService) Start(ctx context.Context)                              {}
func (s *stubSnapshotService) SetSnapshotInterval(string) error                       { return nil }
func (s *stubSnapshotService) SnapshotEndpoint(*portainer.Endpoint) error             { return nil }
func (s *stubSnapshotService) FillSnapshotData(endpoint *portainer.Endpoint, _ bool) error {
	if s.err != nil {
		return s.err
	}
	endpoint.Snapshots = append([]portainer.DockerSnapshot(nil), s.snapshots...)
	return nil
}

func TestREQ_USR_08_FindResourceControlDepth(t *testing.T) {
	t.Parallel()

	_, store := datastore.MustNewTestStore(t, true, false)
	admin := portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	std := portainer.User{ID: 2, Username: "std", Role: portainer.StandardUserRole}
	team := portainer.Team{ID: 10, Name: "devs"}

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&admin))
		require.NoError(t, tx.User().Create(&std))
		require.NoError(t, tx.Team().Create(&team))
		return nil
	}))

	transport := &Transport{
		endpoint:  &portainer.Endpoint{ID: 7},
		dataStore: store,
	}

	directRC := authorization.NewPrivateResourceControl("cid-1", portainer.ContainerResourceControl, std.ID)
	serviceRC := authorization.NewPrivateResourceControl("svc-1", portainer.ServiceResourceControl, std.ID)
	swarmStackID := stackutils.ResourceControlID(7, "swarm-app")
	swarmStackRC := authorization.NewPrivateResourceControl(swarmStackID, portainer.StackResourceControl, std.ID)
	composeStackID := stackutils.ResourceControlID(7, "compose-app")
	composeStackRC := authorization.NewPrivateResourceControl(composeStackID, portainer.StackResourceControl, std.ID)

	rcs := []portainer.ResourceControl{*directRC, *serviceRC, *swarmStackRC, *composeStackRC}

	t.Run("direct hit", func(t *testing.T) {
		t.Parallel()
		got, err := transport.findResourceControl("cid-1", portainer.ContainerResourceControl, nil, rcs)
		require.NoError(t, err)
		require.NotNil(t, got)
		require.Equal(t, "cid-1", got.ResourceID)
	})

	t.Run("nil labels", func(t *testing.T) {
		t.Parallel()
		got, err := transport.findResourceControl("missing", portainer.ContainerResourceControl, nil, rcs)
		require.NoError(t, err)
		require.Nil(t, got)
	})

	t.Run("inherit swarm service label", func(t *testing.T) {
		t.Parallel()
		got, err := transport.findResourceControl("cid-x", portainer.ContainerResourceControl, map[string]any{
			consts.SwarmServiceIDLabel: "svc-1",
		}, rcs)
		require.NoError(t, err)
		require.NotNil(t, got)
		require.Equal(t, "svc-1", got.ResourceID)
	})

	t.Run("inherit swarm stack label", func(t *testing.T) {
		t.Parallel()
		got, err := transport.findResourceControl("cid-x", portainer.ContainerResourceControl, map[string]any{
			consts.SwarmStackNameLabel: "swarm-app",
		}, rcs)
		require.NoError(t, err)
		require.NotNil(t, got)
		require.Equal(t, swarmStackID, got.ResourceID)
	})

	t.Run("inherit compose stack label", func(t *testing.T) {
		t.Parallel()
		got, err := transport.findResourceControl("cid-x", portainer.ContainerResourceControl, map[string]any{
			consts.ComposeStackNameLabel: "compose-app",
		}, rcs)
		require.NoError(t, err)
		require.NotNil(t, got)
		require.Equal(t, composeStackID, got.ResourceID)
	})

	t.Run("portainer public label creates RC", func(t *testing.T) {
		t.Parallel()
		got, err := transport.findResourceControl("public-1", portainer.VolumeResourceControl, map[string]any{
			resourceLabelForPortainerPublicResourceControl: "true",
		}, nil)
		require.NoError(t, err)
		require.NotNil(t, got)
		require.True(t, got.Public)
	})

	t.Run("portainer user and team labels create restricted RC", func(t *testing.T) {
		t.Parallel()
		got, err := transport.findResourceControl("restricted-1", portainer.NetworkResourceControl, map[string]any{
			resourceLabelForPortainerUserResourceControl: "std,unknown-user",
			resourceLabelForPortainerTeamResourceControl: "devs,unknown-team",
		}, nil)
		require.NoError(t, err)
		require.NotNil(t, got)
		require.Len(t, got.UserAccesses, 1)
		require.Equal(t, std.ID, got.UserAccesses[0].UserID)
		require.Len(t, got.TeamAccesses, 1)
		require.Equal(t, team.ID, got.TeamAccesses[0].TeamID)
	})

	t.Run("empty portainer access labels yield nil", func(t *testing.T) {
		t.Parallel()
		got, err := transport.findResourceControl("none-1", portainer.ContainerResourceControl, map[string]any{
			"unrelated": "label",
		}, nil)
		require.NoError(t, err)
		require.Nil(t, got)
	})
}

func TestREQ_NET_01_FindSystemNetworkResourceControl(t *testing.T) {
	t.Parallel()

	for _, name := range []string{"bridge", "host", "ingress", "nat", "none"} {
		name := name
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			rc := findSystemNetworkResourceControl(map[string]any{
				"Id":   "nid-" + name,
				"Name": name,
			})
			require.NotNil(t, rc)
			require.True(t, rc.System)
		})
	}

	require.Nil(t, findSystemNetworkResourceControl(map[string]any{"Id": "x"}))
	require.Nil(t, findSystemNetworkResourceControl(map[string]any{
		"Id": "custom-id", "Name": "custom",
	}))
}

func TestREQ_CTR_04_ContainerInspectOperation(t *testing.T) {
	t.Parallel()

	transport := &Transport{endpoint: &portainer.Endpoint{ID: 1}}
	adminExec := &operationExecutor{
		operationContext: &restrictedDockerOperationContext{isAdmin: true},
	}
	stdExec := &operationExecutor{
		operationContext: &restrictedDockerOperationContext{
			isAdmin: false,
			userID:  9,
		},
	}

	t.Run("admin inspect ok", func(t *testing.T) {
		t.Parallel()
		resp := jsonHTTPResponse(t, http.StatusOK, map[string]any{
			"Id": "abc123",
			"Config": map[string]any{
				"Labels": map[string]any{"app": "web"},
			},
		})
		require.NoError(t, transport.containerInspectOperation(resp, adminExec))
		require.Equal(t, http.StatusOK, resp.StatusCode)
		var decoded map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
		require.NoError(t, resp.Body.Close())
		require.Equal(t, "abc123", decoded["Id"])
	})

	t.Run("non-admin without RC denied", func(t *testing.T) {
		t.Parallel()
		resp := jsonHTTPResponse(t, http.StatusOK, map[string]any{
			"Id": "secret",
			"Config": map[string]any{
				"Labels": map[string]any{},
			},
		})
		require.NoError(t, transport.containerInspectOperation(resp, stdExec))
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	})

	t.Run("non-admin with compose stack RC allowed", func(t *testing.T) {
		t.Parallel()
		stackID := stackutils.ResourceControlID(1, "web")
		rc := authorization.NewPrivateResourceControl(stackID, portainer.StackResourceControl, 9)
		exec := &operationExecutor{
			operationContext: &restrictedDockerOperationContext{
				isAdmin:          false,
				userID:           9,
				resourceControls: []portainer.ResourceControl{*rc},
			},
		}
		resp := jsonHTTPResponse(t, http.StatusOK, map[string]any{
			"Id": "stack-ctr",
			"Config": map[string]any{
				"Labels": map[string]any{
					consts.ComposeStackNameLabel: "web",
				},
			},
		})
		require.NoError(t, transport.containerInspectOperation(resp, exec))
		require.Equal(t, http.StatusOK, resp.StatusCode)
		var decoded map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
		require.NoError(t, resp.Body.Close())
		require.NotNil(t, decoded["Portainer"])
	})
}

func TestREQ_HOST_04_DecorateContainerUpdateOperation_DeviceMapping(t *testing.T) {
	t.Parallel()

	admin := portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	std := portainer.User{ID: 2, Username: "std", Role: portainer.StandardUserRole}
	const containerID = "ctr-update-1"

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

	newUpdateReq := func(user portainer.User, body any) *http.Request {
		t.Helper()
		data, err := json.Marshal(body)
		require.NoError(t, err)
		req := httptest.NewRequest(http.MethodPost, srv.URL+"/v"+version+"/containers/"+containerID+"/update", bytes.NewReader(data))
		return req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
			ID: user.ID, Username: user.Username, Role: user.Role,
		}))
	}

	t.Run("std user device mapping forbidden", func(t *testing.T) {
		resp, err := transport.decorateContainerUpdateOperation(newUpdateReq(std, map[string]any{
			"Devices": []any{map[string]any{"PathOnHost": "/dev/null"}},
		}), containerID)
		require.ErrorIs(t, err, ErrDeviceMappingForbidden)
		require.NotNil(t, resp)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("std user without devices allowed", func(t *testing.T) {
		resp, err := transport.decorateContainerUpdateOperation(newUpdateReq(std, map[string]any{
			"Devices": []any{},
		}), containerID)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	})

	t.Run("admin with devices allowed", func(t *testing.T) {
		resp, err := transport.decorateContainerUpdateOperation(newUpdateReq(admin, map[string]any{
			"Devices": []any{map[string]any{"PathOnHost": "/dev/null"}},
		}), containerID)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	})
}

func TestREQ_VOL_01_GetDockerIDFromSnapshotAndRemote(t *testing.T) {
	t.Parallel()

	t.Run("snapshot cache", func(t *testing.T) {
		t.Parallel()
		transport := &Transport{
			endpoint: &portainer.Endpoint{ID: 3},
			snapshotService: &stubSnapshotService{
				snapshots: []portainer.DockerSnapshot{{
					Swarm: false,
					SnapshotRaw: portainer.DockerSnapshotRaw{
						Info: system.Info{ID: "snap-docker-id"},
					},
				}},
			},
		}
		id, err := transport.getDockerID()
		require.NoError(t, err)
		require.Equal(t, "snap-docker-id", id)
		require.Equal(t, "snap-docker-id", transport.dockerID)
	})

	t.Run("remote info non-swarm", func(t *testing.T) {
		t.Parallel()
		srv, _ := mockDockerAPIServer(t, RoutesDefinition{
			{http.MethodGet, "/info"}: system.Info{ID: "remote-engine-id"},
		})
		t.Cleanup(srv.Close)

		transport := &Transport{
			endpoint:            &portainer.Endpoint{ID: 4, URL: srv.URL},
			dockerClientFactory: dockerclient.NewClientFactory(nil, nil),
		}
		id, err := transport.getDockerID()
		require.NoError(t, err)
		require.Equal(t, "remote-engine-id", id)
	})
}

func TestREQ_VOL_01_InheritedResourceControlFromVolumeLabels(t *testing.T) {
	t.Parallel()

	stackID := stackutils.ResourceControlID(5, "compose-vol")
	rc := authorization.NewPrivateResourceControl(stackID, portainer.StackResourceControl, 2)

	srv, _ := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodGet, "/volumes/data"}: volume.Volume{
			Name: "data",
			Labels: map[string]string{
				consts.ComposeStackNameLabel: "compose-vol",
			},
		},
		{http.MethodGet, "/volumes/plain"}: volume.Volume{
			Name:   "plain",
			Labels: map[string]string{},
		},
	})
	t.Cleanup(srv.Close)

	cli, err := dockerclient.NewClientFactory(nil, nil).CreateClient(&portainer.Endpoint{URL: srv.URL}, "", nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = cli.Close() })

	got, err := getInheritedResourceControlFromVolumeLabels(cli, 5, "data", []portainer.ResourceControl{*rc})
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, rc.ResourceID, got.ResourceID)

	got, err = getInheritedResourceControlFromVolumeLabels(cli, 5, "plain", []portainer.ResourceControl{*rc})
	require.NoError(t, err)
	require.Nil(t, got)
}

func TestREQ_NET_03_InheritedResourceControlFromNetworkLabels(t *testing.T) {
	t.Parallel()

	stackID := stackutils.ResourceControlID(8, "net-stack")
	rc := authorization.NewPrivateResourceControl(stackID, portainer.StackResourceControl, 2)

	srv, _ := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodGet, "/networks/mynet"}: network.Inspect{
			ID:   "nid-1",
			Name: "mynet",
			Labels: map[string]string{
				consts.ComposeStackNameLabel: "net-stack",
			},
		},
	})
	t.Cleanup(srv.Close)

	cli, err := dockerclient.NewClientFactory(nil, nil).CreateClient(&portainer.Endpoint{URL: srv.URL}, "", nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = cli.Close() })

	got, err := getInheritedResourceControlFromNetworkLabels(cli, 8, "mynet", []portainer.ResourceControl{*rc})
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, rc.ResourceID, got.ResourceID)
}

func TestREQ_CTR_04_InheritedResourceControlFromContainerLabels(t *testing.T) {
	t.Parallel()

	serviceRC := authorization.NewPrivateResourceControl("svc-abc", portainer.ServiceResourceControl, 2)
	stackID := stackutils.ResourceControlID(9, "ctr-stack")
	stackRC := authorization.NewPrivateResourceControl(stackID, portainer.StackResourceControl, 2)

	srv, _ := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodGet, "/containers/c-svc/json"}: map[string]any{
			"Id": "c-svc",
			"Config": map[string]any{
				"Labels": map[string]string{
					consts.SwarmServiceIDLabel: "svc-abc",
				},
			},
		},
		{http.MethodGet, "/containers/c-stack/json"}: map[string]any{
			"Id": "c-stack",
			"Config": map[string]any{
				"Labels": map[string]string{
					consts.ComposeStackNameLabel: "ctr-stack",
				},
			},
		},
		{http.MethodGet, "/containers/c-none/json"}: map[string]any{
			"Id": "c-none",
			"Config": map[string]any{
				"Labels": map[string]string{},
			},
		},
	})
	t.Cleanup(srv.Close)

	cli, err := dockerclient.NewClientFactory(nil, nil).CreateClient(&portainer.Endpoint{URL: srv.URL}, "", nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = cli.Close() })

	rcs := []portainer.ResourceControl{*serviceRC, *stackRC}

	got, err := getInheritedResourceControlFromContainerLabels(cli, 9, "c-svc", rcs)
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, serviceRC.ResourceID, got.ResourceID)

	got, err = getInheritedResourceControlFromContainerLabels(cli, 9, "c-stack", rcs)
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, stackRC.ResourceID, got.ResourceID)

	got, err = getInheritedResourceControlFromContainerLabels(cli, 9, "c-none", rcs)
	require.NoError(t, err)
	require.Nil(t, got)
}

func TestREQ_USR_08_GetInheritedResourceControlFromServiceOrStack(t *testing.T) {
	t.Parallel()

	stackID := stackutils.ResourceControlID(2, "vol-stack")
	rc := authorization.NewPrivateResourceControl(stackID, portainer.StackResourceControl, 1)

	srv, _ := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodGet, "/volumes/v1"}: volume.Volume{
			Name: "v1",
			Labels: map[string]string{
				consts.ComposeStackNameLabel: "vol-stack",
			},
		},
		{http.MethodGet, "/networks/n1"}: network.Inspect{
			ID:   "n1",
			Name: "n1",
			Labels: map[string]string{
				consts.ComposeStackNameLabel: "vol-stack",
			},
		},
		{http.MethodGet, "/containers/c1/json"}: map[string]any{
			"Id": "c1",
			"Config": map[string]any{
				"Labels": map[string]string{
					consts.ComposeStackNameLabel: "vol-stack",
				},
			},
		},
	})
	t.Cleanup(srv.Close)

	transport := &Transport{
		endpoint:            &portainer.Endpoint{ID: 2, URL: srv.URL},
		dockerClientFactory: dockerclient.NewClientFactory(nil, nil),
	}
	cli, err := transport.dockerClientFactory.CreateClient(transport.endpoint, "", nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = cli.Close() })

	rcs := []portainer.ResourceControl{*rc}

	got, err := transport.getInheritedResourceControlFromServiceOrStack(cli, "v1", portainer.VolumeResourceControl, rcs)
	require.NoError(t, err)
	require.NotNil(t, got)

	got, err = transport.getInheritedResourceControlFromServiceOrStack(cli, "n1", portainer.NetworkResourceControl, rcs)
	require.NoError(t, err)
	require.NotNil(t, got)

	got, err = transport.getInheritedResourceControlFromServiceOrStack(cli, "c1", portainer.ContainerResourceControl, rcs)
	require.NoError(t, err)
	require.NotNil(t, got)

	got, err = transport.getInheritedResourceControlFromServiceOrStack(cli, "x", portainer.ResourceControlType(0), rcs)
	require.NoError(t, err)
	require.Nil(t, got)
}

func TestREQ_VOL_01_FilterVolumeListForNonAdmin(t *testing.T) {
	t.Parallel()

	ownerRC := authorization.NewPrivateResourceControl("owned_d1", portainer.VolumeResourceControl, 2)
	transport := &Transport{
		dockerID:  "d1",
		endpoint:  &portainer.Endpoint{ID: 1},
		dataStore: nil,
	}
	executor := &operationExecutor{
		operationContext: &restrictedDockerOperationContext{
			isAdmin:          false,
			userID:           2,
			resourceControls: []portainer.ResourceControl{*ownerRC},
		},
	}

	resp := jsonHTTPResponse(t, http.StatusOK, map[string]any{
		"Volumes": []any{
			map[string]any{"Name": "owned", "Labels": map[string]any{}},
			map[string]any{"Name": "other", "Labels": map[string]any{}},
		},
	})
	require.NoError(t, transport.volumeListOperation(resp, executor))

	var decoded map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
	require.NoError(t, resp.Body.Close())
	vols := decoded["Volumes"].([]any)
	require.Len(t, vols, 1)
	require.Equal(t, "owned_d1", vols[0].(map[string]any)[volumeObjectIdentifier])
}

func TestREQ_CTR_01_ProxyContainerListWithLabelFiltering(t *testing.T) {
	t.Parallel()

	admin := portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&admin))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{ID: 1, Name: "env"}))
		settings, err := tx.Settings().Settings()
		require.NoError(t, err)
		settings.BlackListedLabels = []portainer.Pair{{Name: "hidden", Value: "1"}}
		require.NoError(t, tx.Settings().UpdateSettings(settings))
		return nil
	}))

	srv, version := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodGet, "/containers/json"}: []any{
			map[string]any{"Id": "keep", "Labels": map[string]any{"app": "a"}},
			map[string]any{"Id": "drop", "Labels": map[string]any{"hidden": "1"}},
		},
	})
	t.Cleanup(srv.Close)

	transport := &Transport{
		endpoint:      &portainer.Endpoint{ID: 1, URL: srv.URL},
		dataStore:     store,
		HTTPTransport: &http.Transport{},
	}

	req := httptest.NewRequest(http.MethodGet, srv.URL+"/v"+version+"/containers/json", nil)
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
		ID: admin.ID, Username: admin.Username, Role: admin.Role,
	}))
	resp, err := transport.proxyContainerRequest(req, "/containers/json")
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var decoded []any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
	require.NoError(t, resp.Body.Close())
	require.Len(t, decoded, 1)
	require.Equal(t, "keep", decoded[0].(map[string]any)["Id"])
}

func TestREQ_VOL_05_ProxyVolumePruneAdminOnly(t *testing.T) {
	t.Parallel()

	admin := portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	std := portainer.User{ID: 2, Username: "std", Role: portainer.StandardUserRole}
	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&admin))
		require.NoError(t, tx.User().Create(&std))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{ID: 1, Name: "env"}))
		return nil
	}))

	srv, version := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodPost, "/volumes/prune"}: map[string]any{"VolumesDeleted": []string{}, "SpaceReclaimed": 0},
	})
	t.Cleanup(srv.Close)

	transport := &Transport{
		endpoint:      &portainer.Endpoint{ID: 1, URL: srv.URL},
		dataStore:     store,
		HTTPTransport: &http.Transport{},
	}

	call := func(user portainer.User) *http.Response {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, srv.URL+"/v"+version+"/volumes/prune", http.NoBody)
		req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
			ID: user.ID, Username: user.Username, Role: user.Role,
		}))
		resp, err := transport.proxyVolumeRequest(req, "/volumes/prune")
		require.NoError(t, err)
		require.NotNil(t, resp)
		return resp
	}

	resp := call(admin)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.NoError(t, resp.Body.Close())

	resp = call(std)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)
	require.NoError(t, resp.Body.Close())
}

func TestREQ_CTR_04_ProxyContainerInspect(t *testing.T) {
	t.Parallel()

	admin := portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	std := portainer.User{ID: 2, Username: "std", Role: portainer.StandardUserRole}
	const containerID = "inspect-me"

	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&admin))
		require.NoError(t, tx.User().Create(&std))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{ID: 1, Name: "env"}))
		require.NoError(t, tx.ResourceControl().Create(
			authorization.NewPrivateResourceControl(containerID, portainer.ContainerResourceControl, std.ID),
		))
		return nil
	}))

	srv, version := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodGet, "/containers/" + containerID + "/json"}: map[string]any{
			"Id": containerID,
			"Config": map[string]any{
				"Labels": map[string]any{},
			},
		},
	})
	t.Cleanup(srv.Close)

	transport := &Transport{
		endpoint:      &portainer.Endpoint{ID: 1, URL: srv.URL},
		dataStore:     store,
		HTTPTransport: &http.Transport{},
	}

	call := func(user portainer.User) *http.Response {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, srv.URL+"/v"+version+"/containers/"+containerID+"/json", nil)
		req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
			ID: user.ID, Username: user.Username, Role: user.Role,
		}))
		resp, err := transport.proxyContainerRequest(req, "/containers/"+containerID+"/json")
		require.NoError(t, err)
		require.NotNil(t, resp)
		return resp
	}

	resp := call(admin)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.NoError(t, resp.Body.Close())

	resp = call(std)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.NoError(t, resp.Body.Close())

	// non-owner of a different container id without RC is denied
	srv2, version2 := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodGet, "/containers/other/json"}: map[string]any{
			"Id": "other",
			"Config": map[string]any{"Labels": map[string]any{}},
		},
	})
	t.Cleanup(srv2.Close)
	transport.endpoint.URL = srv2.URL
	req := httptest.NewRequest(http.MethodGet, srv2.URL+"/v"+version2+"/containers/other/json", nil)
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
		ID: std.ID, Username: std.Username, Role: std.Role,
	}))
	resp, err := transport.proxyContainerRequest(req, "/containers/other/json")
	require.NoError(t, err)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)
	require.NoError(t, resp.Body.Close())
}

func TestNewTransport_WiresDependencies(t *testing.T) {
	t.Parallel()

	ht := &http.Transport{}
	params := &TransportParameters{
		Endpoint:  &portainer.Endpoint{ID: 1},
		DataStore: nil,
	}
	tr, err := NewTransport(params, ht, nil, &stubSnapshotService{})
	require.NoError(t, err)
	require.Same(t, ht, tr.HTTPTransport)
	require.Equal(t, portainer.EndpointID(1), tr.endpoint.ID)
	require.NotNil(t, tr.snapshotService)
}

func TestREQ_NET_01_NetworkListDecoratesSystemNetworks(t *testing.T) {
	t.Parallel()

	transport := &Transport{endpoint: &portainer.Endpoint{ID: 1}}
	executor := &operationExecutor{
		operationContext: &restrictedDockerOperationContext{isAdmin: true},
	}

	data, err := json.Marshal([]any{
		map[string]any{"Id": "b1", "Name": "bridge", "Labels": map[string]any{}},
		map[string]any{"Id": "c1", "Name": "custom", "Labels": map[string]any{}},
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
	bridge := decoded[0].(map[string]any)
	require.NotNil(t, bridge["Portainer"])
}

func TestRoundTrip_DelegatesToProxyDockerRequest(t *testing.T) {
	t.Parallel()

	admin := portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	_, store := datastore.MustNewTestStore(t, true, false)
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.User().Create(&admin))
		require.NoError(t, tx.Endpoint().Create(&portainer.Endpoint{ID: 1, Name: "env"}))
		return nil
	}))

	srv, apiVersion := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodGet, "/version"}: map[string]any{"ApiVersion": "1.51"},
	})
	t.Cleanup(srv.Close)

	transport := &Transport{
		endpoint:      &portainer.Endpoint{ID: 1, URL: srv.URL},
		dataStore:     store,
		HTTPTransport: &http.Transport{},
	}

	req := httptest.NewRequest(http.MethodGet, srv.URL+"/v"+apiVersion+"/version", nil)
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{
		ID: admin.ID, Username: admin.Username, Role: admin.Role,
	}))
	resp, err := transport.RoundTrip(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.NoError(t, resp.Body.Close())
}

func TestREQ_VOL_01_GetDockerIDFromSwarmClusterInfo(t *testing.T) {
	t.Parallel()

	srv, _ := mockDockerAPIServer(t, RoutesDefinition{
		{http.MethodGet, "/info"}: system.Info{
			ID: "node-id",
			Swarm: swarm.Info{
				Cluster: &swarm.ClusterInfo{ID: "swarm-cluster-id"},
			},
		},
	})
	t.Cleanup(srv.Close)

	transport := &Transport{
		endpoint:            &portainer.Endpoint{ID: 11, URL: srv.URL},
		dockerClientFactory: dockerclient.NewClientFactory(nil, nil),
	}
	id, err := transport.getDockerID()
	require.NoError(t, err)
	require.Equal(t, "swarm-cluster-id", id)
}
