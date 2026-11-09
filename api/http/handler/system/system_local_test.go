package system

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/testhelpers"
	"github.com/portainer/portainer/api/jwt"
	plf "github.com/portainer/portainer/api/platform"
	"github.com/portainer/portainer/pkg/featureflags"
	libclient "github.com/portainer/portainer/pkg/libhttp/client"

	"github.com/pkg/errors"
	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Phase C KEEP tests for local Portainer system status/version/info/nodes.
// system_upgrade.go (Business Edition upgrade) is deferred-within-package.

type stubPlatformService struct {
	platform    plf.ContainerPlatform
	platformErr error
	env         *portainer.Endpoint
	envErr      error
}

func (s *stubPlatformService) GetLocalEnvironment() (*portainer.Endpoint, error) {
	if s.envErr != nil {
		return nil, s.envErr
	}
	return s.env, nil
}

func (s *stubPlatformService) GetPlatform() (plf.ContainerPlatform, error) {
	if s.platformErr != nil {
		return "", s.platformErr
	}
	return s.platform, nil
}

func setupSystemHandler(t *testing.T, platform plf.Service) (*Handler, *datastore.Store, string, string) {
	t.Helper()

	_, store := datastore.MustNewTestStore(t, true, true)

	adminUser := &portainer.User{ID: 1, Username: "admin", Role: portainer.AdministratorRole}
	require.NoError(t, store.User().Create(adminUser))
	stdUser := &portainer.User{ID: 2, Username: "user", Role: portainer.StandardUserRole}
	require.NoError(t, store.User().Create(stdUser))

	jwtService, err := jwt.NewService("1h", store)
	require.NoError(t, err)
	bouncer := security.NewRequestBouncer(t.Context(), store)

	status := &portainer.Status{Version: portainer.APIVersion}
	h := NewHandler(bouncer, status, store, platform, nil)

	adminJWT, _, _ := jwtService.GenerateToken(&portainer.TokenData{ID: adminUser.ID, Username: adminUser.Username, Role: adminUser.Role})
	userJWT, _, _ := jwtService.GenerateToken(&portainer.TokenData{ID: stdUser.ID, Username: stdUser.Username, Role: stdUser.Role})
	return h, store, adminJWT, userJWT
}

func TestREQ_ENV_02_SystemStatus_Public(t *testing.T) {
	t.Parallel()

	h, _, _, _ := setupSystemHandler(t, &stubPlatformService{platform: plf.PlatformDocker})

	req := httptest.NewRequest(http.MethodGet, "/system/status", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var resp status
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
	assert.Equal(t, portainer.APIVersion, resp.Version)
}

func TestREQ_ENV_02_StatusInspectDeprecated_Public(t *testing.T) {
	t.Parallel()

	h, _, _, _ := setupSystemHandler(t, &stubPlatformService{platform: plf.PlatformDocker})

	req := httptest.NewRequest(http.MethodGet, "/status", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var resp status
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
	assert.Equal(t, portainer.APIVersion, resp.Version)
}

func TestREQ_ENV_02_SystemVersion_AdminIncludesRuntime(t *testing.T) {
	t.Parallel()

	h, _, adminJWT, userJWT := setupSystemHandler(t, &stubPlatformService{platform: plf.PlatformDocker})

	t.Run("admin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/system/version", nil)
		testhelpers.AddTestSecurityCookie(req, adminJWT)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		require.Equal(t, http.StatusOK, rr.Code)

		body, err := io.ReadAll(rr.Body)
		require.NoError(t, err)
		var resp versionResponse
		require.NoError(t, json.Unmarshal(body, &resp))
		assert.Equal(t, "CE", resp.ServerEdition)
		assert.Equal(t, portainer.APIVersion, resp.ServerVersion)
		assert.NotNil(t, resp.Runtime.Env)
	})

	// REQ-TAI-001: there are no roles; a leftover standard-user cookie is
	// ignored and the request is served as the local operator.
	t.Run("REQ-TAI-001 leftover standard-user cookie is served as the local operator", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/system/version", nil)
		testhelpers.AddTestSecurityCookie(req, userJWT)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		require.Equal(t, http.StatusOK, rr.Code)

		var resp versionResponse
		require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
		assert.Equal(t, "CE", resp.ServerEdition)
		assert.NotNil(t, resp.Runtime.Env)
	})
}

func TestREQ_ENV_02_SystemInfo_CountsLocalAgentsAndPlatform(t *testing.T) {
	t.Parallel()

	platform := &stubPlatformService{platform: plf.PlatformDockerStandalone}
	h, store, adminJWT, _ := setupSystemHandler(t, platform)

	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   1,
		Name: "local",
		Type: portainer.DockerEnvironment,
	}))
	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   2,
		Name: "agent",
		Type: portainer.AgentOnDockerEnvironment,
	}))
	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   3,
		Name: "edge",
		Type: portainer.EdgeAgentOnDockerEnvironment,
	}))

	req := httptest.NewRequest(http.MethodGet, "/system/info", nil)
	testhelpers.AddTestSecurityCookie(req, adminJWT)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var resp systemInfoResponse
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
	assert.Equal(t, 2, resp.Agents) // agent + edge agent types
	assert.Equal(t, 1, resp.EdgeAgents)
	assert.Equal(t, plf.PlatformDockerStandalone, resp.Platform)
}

func TestREQ_ENV_02_SystemInfo_NoLocalEnvironmentDefaultsDocker(t *testing.T) {
	t.Parallel()

	platform := &stubPlatformService{platformErr: plf.ErrNoLocalEnvironment}
	h, _, adminJWT, _ := setupSystemHandler(t, platform)

	req := httptest.NewRequest(http.MethodGet, "/system/info", nil)
	testhelpers.AddTestSecurityCookie(req, adminJWT)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var resp systemInfoResponse
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
	assert.Equal(t, plf.PlatformDocker, resp.Platform)
}

func TestREQ_ENV_02_SystemInfo_PlatformFailure(t *testing.T) {
	t.Parallel()

	platform := &stubPlatformService{platformErr: errors.New("boom")}
	h, _, adminJWT, _ := setupSystemHandler(t, platform)

	req := httptest.NewRequest(http.MethodGet, "/system/info", nil)
	testhelpers.AddTestSecurityCookie(req, adminJWT)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestREQ_ENV_02_SystemNodesCount_LocalDocker(t *testing.T) {
	t.Parallel()

	h, store, adminJWT, _ := setupSystemHandler(t, &stubPlatformService{platform: plf.PlatformDocker})

	require.NoError(t, store.Endpoint().Create(&portainer.Endpoint{
		ID:   1,
		Name: "local",
		Type: portainer.DockerEnvironment,
	}))
	require.NoError(t, store.Snapshot().Create(&portainer.Snapshot{
		EndpointID: 1,
		Docker:     &portainer.DockerSnapshot{NodeCount: 3},
	}))

	req := httptest.NewRequest(http.MethodGet, "/system/nodes", nil)
	testhelpers.AddTestSecurityCookie(req, adminJWT)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var resp nodesCountResponse
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
	assert.Equal(t, 3, resp.Nodes)
}

func TestREQ_ENV_02_SystemNodesCount_EmptyStore(t *testing.T) {
	t.Parallel()

	h, _, adminJWT, _ := setupSystemHandler(t, &stubPlatformService{platform: plf.PlatformDocker})

	req := httptest.NewRequest(http.MethodGet, "/system/nodes", nil)
	testhelpers.AddTestSecurityCookie(req, adminJWT)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var resp nodesCountResponse
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&resp))
	assert.Equal(t, 0, resp.Nodes)
}

func TestHasNewerVersion(t *testing.T) {
	t.Parallel()

	assert.True(t, HasNewerVersion("2.19.0", "2.20.0"))
	assert.False(t, HasNewerVersion("2.20.0", "2.19.0"))
	assert.False(t, HasNewerVersion("2.20.0", "2.20.0"))
	assert.False(t, HasNewerVersion("not-a-semver", "2.20.0"))
	assert.False(t, HasNewerVersion("2.20.0", "not-a-semver"))
	assert.False(t, HasNewerVersion("2.20.0", ""))
}

func TestGetLatestVersion_ExternalRequestDisabled(t *testing.T) {
	featureflags.Parse([]string{string(libclient.DisableExternalRequests)}, []featureflags.Feature{libclient.DisableExternalRequests})
	t.Cleanup(func() {
		featureflags.Parse(nil, []featureflags.Feature{libclient.DisableExternalRequests})
	})

	assert.Empty(t, GetLatestVersion())
}
