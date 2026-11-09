package endpoint_test

import (
	"testing"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices/endpoint"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

func localDockerEndpoint(id portainer.EndpointID, name, url string) *portainer.Endpoint {
	return &portainer.Endpoint{
		ID:      id,
		Name:    name,
		URL:     url,
		Type:    portainer.DockerEnvironment,
		GroupID: 1,
		Status:  portainer.EndpointStatusUp,
	}
}

// TestREQ_ENV_04_CreateLocalDockerUnixEndpoint persists a local Docker
// environment that uses the host socket URL.
func TestREQ_ENV_04_CreateLocalDockerUnixEndpoint(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	id := portainer.EndpointID(store.Endpoint().GetNextIdentifier())
	ep := localDockerEndpoint(id, "local", "unix:///var/run/docker.sock")
	require.NoError(t, store.Endpoint().Create(ep))

	got, err := store.Endpoint().Endpoint(id)
	require.NoError(t, err)
	require.Equal(t, "local", got.Name)
	require.Equal(t, "unix:///var/run/docker.sock", got.URL)
	require.Equal(t, portainer.DockerEnvironment, got.Type)
	require.Equal(t, portainer.EndpointStatusUp, got.Status)
}

// TestREQ_ENV_04_CreateLocalDockerTCPEndpoint persists a local Docker
// environment reached over loopback TCP.
func TestREQ_ENV_04_CreateLocalDockerTCPEndpoint(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	id := portainer.EndpointID(store.Endpoint().GetNextIdentifier())
	ep := localDockerEndpoint(id, "local-tcp", "tcp://127.0.0.1:2375")
	require.NoError(t, store.Endpoint().Create(ep))

	got, err := store.Endpoint().Endpoint(id)
	require.NoError(t, err)
	require.Equal(t, "tcp://127.0.0.1:2375", got.URL)
	require.Equal(t, portainer.DockerEnvironment, got.Type)
}

// TestREQ_ENV_03_CreateReadUpdateDeleteLocalDockerEndpoint covers the
// local Docker environment datastore path: create, read, update name/URL,
// delete.
func TestREQ_ENV_03_CreateReadUpdateDeleteLocalDockerEndpoint(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	id := portainer.EndpointID(store.Endpoint().GetNextIdentifier())
	ep := localDockerEndpoint(id, "compose-host", "unix:///var/run/docker.sock")
	require.NoError(t, store.Endpoint().Create(ep))

	got, err := store.Endpoint().Endpoint(id)
	require.NoError(t, err)
	require.Equal(t, "compose-host", got.Name)

	got.Name = "compose-host-renamed"
	got.URL = "tcp://127.0.0.1:2375"
	got.PublicURL = "docker.example.test"
	require.NoError(t, store.Endpoint().UpdateEndpoint(id, got))

	updated, err := store.Endpoint().Endpoint(id)
	require.NoError(t, err)
	require.Equal(t, "compose-host-renamed", updated.Name)
	require.Equal(t, "tcp://127.0.0.1:2375", updated.URL)
	require.Equal(t, "docker.example.test", updated.PublicURL)

	require.NoError(t, store.Endpoint().DeleteEndpoint(id))
	_, err = store.Endpoint().Endpoint(id)
	require.Error(t, err)
}

// TestREQ_ENV_01_EndpointsListsLocalDockerEnvironments returns every
// stored local Docker environment with heartbeat overlay.
func TestREQ_ENV_01_EndpointsListsLocalDockerEnvironments(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	id1 := portainer.EndpointID(store.Endpoint().GetNextIdentifier())
	require.NoError(t, store.Endpoint().Create(localDockerEndpoint(id1, "a", "unix:///var/run/docker.sock")))
	id2 := portainer.EndpointID(store.Endpoint().GetNextIdentifier())
	require.NoError(t, store.Endpoint().Create(localDockerEndpoint(id2, "b", "tcp://127.0.0.1:2375")))

	store.Endpoint().UpdateHeartbeat(id1)

	all, err := store.Endpoint().Endpoints()
	require.NoError(t, err)
	require.Len(t, all, 2)

	byName := map[string]portainer.Endpoint{}
	for _, e := range all {
		byName[e.Name] = e
	}
	require.Contains(t, byName, "a")
	require.Contains(t, byName, "b")
	require.Greater(t, byName["a"].LastCheckInDate, int64(0))
}

// TestREQ_ENV_01_ReadAllFiltersLocalDockerEnvironments applies predicates
// when listing environments.
func TestREQ_ENV_01_ReadAllFiltersLocalDockerEnvironments(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	id1 := portainer.EndpointID(store.Endpoint().GetNextIdentifier())
	require.NoError(t, store.Endpoint().Create(localDockerEndpoint(id1, "keep", "unix:///var/run/docker.sock")))
	id2 := portainer.EndpointID(store.Endpoint().GetNextIdentifier())
	require.NoError(t, store.Endpoint().Create(localDockerEndpoint(id2, "drop", "tcp://127.0.0.1:2375")))

	all, err := store.Endpoint().ReadAll()
	require.NoError(t, err)
	require.Len(t, all, 2)

	filtered, err := store.Endpoint().ReadAll(func(e portainer.Endpoint) bool {
		return e.Name == "keep"
	})
	require.NoError(t, err)
	require.Len(t, filtered, 1)
	require.Equal(t, "keep", filtered[0].Name)
	require.Equal(t, "unix:///var/run/docker.sock", filtered[0].URL)
}

// TestREQ_ENV_03_EndpointsByTeamIDFiltersLocalAccess returns only local
// Docker environments that grant the given team access.
func TestREQ_ENV_03_EndpointsByTeamIDFiltersLocalAccess(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	teamA := portainer.TeamID(7)
	teamB := portainer.TeamID(8)

	idShared := portainer.EndpointID(store.Endpoint().GetNextIdentifier())
	shared := localDockerEndpoint(idShared, "shared", "unix:///var/run/docker.sock")
	shared.TeamAccessPolicies = portainer.TeamAccessPolicies{
		teamA: {RoleID: 1},
		teamB: {RoleID: 1},
	}
	require.NoError(t, store.Endpoint().Create(shared))

	idOther := portainer.EndpointID(store.Endpoint().GetNextIdentifier())
	other := localDockerEndpoint(idOther, "other", "tcp://127.0.0.1:2375")
	other.TeamAccessPolicies = portainer.TeamAccessPolicies{
		teamB: {RoleID: 1},
	}
	require.NoError(t, store.Endpoint().Create(other))

	idNone := portainer.EndpointID(store.Endpoint().GetNextIdentifier())
	require.NoError(t, store.Endpoint().Create(localDockerEndpoint(idNone, "none", "unix:///var/run/docker.sock")))

	forTeamA, err := store.Endpoint().EndpointsByTeamID(teamA)
	require.NoError(t, err)
	require.Len(t, forTeamA, 1)
	require.Equal(t, "shared", forTeamA[0].Name)

	forTeamB, err := store.Endpoint().EndpointsByTeamID(teamB)
	require.NoError(t, err)
	require.Len(t, forTeamB, 2)

	forMissing, err := store.Endpoint().EndpointsByTeamID(99)
	require.NoError(t, err)
	require.Empty(t, forMissing)
}

func TestREQ_ENV_03_GetNextIdentifierIncrements(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	first := store.Endpoint().GetNextIdentifier()
	require.Greater(t, first, 0)

	require.NoError(t, store.Endpoint().Create(localDockerEndpoint(
		portainer.EndpointID(first), "n1", "unix:///var/run/docker.sock",
	)))

	second := store.Endpoint().GetNextIdentifier()
	require.Greater(t, second, first)
}

func TestREQ_ENV_03_BucketName(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)
	require.Equal(t, "endpoints", store.Endpoint().BucketName())
	require.Equal(t, endpoint.BucketName, store.Endpoint().BucketName())
}

func TestREQ_ENV_03_EndpointMissingReturnsError(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	_, err := store.Endpoint().Endpoint(portainer.EndpointID(404))
	require.Error(t, err)
}

func TestREQ_ENV_03_HeartbeatAndUpdateHeartbeat(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	id := portainer.EndpointID(store.Endpoint().GetNextIdentifier())
	ep := localDockerEndpoint(id, "hb", "unix:///var/run/docker.sock")
	ep.LastCheckInDate = 111
	require.NoError(t, store.Endpoint().Create(ep))

	ts, ok := store.Endpoint().Heartbeat(id)
	require.True(t, ok)
	require.Equal(t, int64(111), ts)

	_, ok = store.Endpoint().Heartbeat(portainer.EndpointID(9999))
	require.False(t, ok)

	before := time.Now().Unix()
	store.Endpoint().UpdateHeartbeat(id)
	after := time.Now().Unix()

	ts, ok = store.Endpoint().Heartbeat(id)
	require.True(t, ok)
	require.GreaterOrEqual(t, ts, before)
	require.LessOrEqual(t, ts, after)

	got, err := store.Endpoint().Endpoint(id)
	require.NoError(t, err)
	require.Equal(t, ts, got.LastCheckInDate)
}

func TestREQ_ENV_03_DeleteClearsHeartbeat(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	id := portainer.EndpointID(store.Endpoint().GetNextIdentifier())
	require.NoError(t, store.Endpoint().Create(localDockerEndpoint(id, "gone", "unix:///var/run/docker.sock")))
	store.Endpoint().UpdateHeartbeat(id)

	require.NoError(t, store.Endpoint().DeleteEndpoint(id))
	_, ok := store.Endpoint().Heartbeat(id)
	require.False(t, ok)
}

// TestREQ_ENV_03_NewServiceReloadsLocalHeartbeats covers NewService loading
// existing local Docker endpoints into the in-memory heartbeat map.
func TestREQ_ENV_03_NewServiceReloadsLocalHeartbeats(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	id := portainer.EndpointID(store.Endpoint().GetNextIdentifier())
	ep := localDockerEndpoint(id, "reload", "unix:///var/run/docker.sock")
	ep.LastCheckInDate = 2222
	require.NoError(t, store.Endpoint().Create(ep))

	reloaded, err := endpoint.NewService(store.GetConnection())
	require.NoError(t, err)

	ts, ok := reloaded.Heartbeat(id)
	require.True(t, ok)
	require.Equal(t, int64(2222), ts)
	require.Equal(t, "endpoints", reloaded.BucketName())
}
