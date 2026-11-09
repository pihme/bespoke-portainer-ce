package endpointutils

import (
	"errors"
	"testing"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type isEndpointTypeTest struct {
	endpointType portainer.EndpointType
	expected     bool
}

func Test_IsDockerEndpoint(t *testing.T) {
	t.Parallel()
	tests := []isEndpointTypeTest{
		{endpointType: portainer.DockerEnvironment, expected: true},
		{endpointType: portainer.AgentOnDockerEnvironment, expected: true},
		{endpointType: portainer.AzureEnvironment, expected: false},
		{endpointType: portainer.EdgeAgentOnDockerEnvironment, expected: true},
		{endpointType: portainer.KubernetesLocalEnvironment, expected: false},
		{endpointType: portainer.AgentOnKubernetesEnvironment, expected: false},
		{endpointType: portainer.EdgeAgentOnKubernetesEnvironment, expected: false},
	}

	for _, test := range tests {
		ans := IsDockerEndpoint(&portainer.Endpoint{Type: test.endpointType})
		assert.Equal(t, test.expected, ans)
	}
}

func Test_IsKubernetesEndpoint(t *testing.T) {
	t.Parallel()
	tests := []isEndpointTypeTest{
		{endpointType: portainer.DockerEnvironment, expected: false},
		{endpointType: portainer.AgentOnDockerEnvironment, expected: false},
		{endpointType: portainer.AzureEnvironment, expected: false},
		{endpointType: portainer.EdgeAgentOnDockerEnvironment, expected: false},
		{endpointType: portainer.KubernetesLocalEnvironment, expected: true},
		{endpointType: portainer.AgentOnKubernetesEnvironment, expected: true},
		{endpointType: portainer.EdgeAgentOnKubernetesEnvironment, expected: true},
	}

	for _, test := range tests {
		ans := IsKubernetesEndpoint(&portainer.Endpoint{Type: test.endpointType})
		assert.Equal(t, test.expected, ans)
	}
}

func Test_IsAgentEndpoint(t *testing.T) {
	t.Parallel()
	tests := []isEndpointTypeTest{
		{endpointType: portainer.DockerEnvironment, expected: false},
		{endpointType: portainer.AgentOnDockerEnvironment, expected: true},
		{endpointType: portainer.AzureEnvironment, expected: false},
		{endpointType: portainer.EdgeAgentOnDockerEnvironment, expected: true},
		{endpointType: portainer.KubernetesLocalEnvironment, expected: false},
		{endpointType: portainer.AgentOnKubernetesEnvironment, expected: true},
		{endpointType: portainer.EdgeAgentOnKubernetesEnvironment, expected: true},
	}

	for _, test := range tests {
		ans := IsAgentEndpoint(&portainer.Endpoint{Type: test.endpointType})
		assert.Equal(t, test.expected, ans)
	}
}

func TestREQ_ENV_04_IsLocalEndpoint(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		endpoint portainer.Endpoint
		want     bool
	}{
		{name: "unix socket docker", endpoint: portainer.Endpoint{Type: portainer.DockerEnvironment, URL: "unix:///var/run/docker.sock"}, want: true},
		{name: "npipe windows docker", endpoint: portainer.Endpoint{Type: portainer.DockerEnvironment, URL: "npipe://./pipe/docker_engine"}, want: true},
		{name: "tcp remote docker", endpoint: portainer.Endpoint{Type: portainer.DockerEnvironment, URL: "tcp://host:2375"}, want: false},
		{name: "kubernetes local type", endpoint: portainer.Endpoint{Type: portainer.KubernetesLocalEnvironment, URL: "https://k8s"}, want: true},
		{name: "agent docker tcp", endpoint: portainer.Endpoint{Type: portainer.AgentOnDockerEnvironment, URL: "tcp://agent:9001"}, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tt.want, IsLocalEndpoint(&tt.endpoint))
		})
	}
}

func TestREQ_ENV_07_EndpointPlatformType(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		endpoint portainer.Endpoint
		want     portainer.PlatformType
	}{
		{name: "docker local", endpoint: portainer.Endpoint{Type: portainer.DockerEnvironment}, want: portainer.DockerPlatformType},
		{name: "docker agent", endpoint: portainer.Endpoint{Type: portainer.AgentOnDockerEnvironment}, want: portainer.DockerPlatformType},
		{name: "docker edge", endpoint: portainer.Endpoint{Type: portainer.EdgeAgentOnDockerEnvironment}, want: portainer.DockerPlatformType},
		{name: "podman local", endpoint: portainer.Endpoint{Type: portainer.DockerEnvironment, ContainerEngine: portainer.ContainerEnginePodman}, want: portainer.PodmanPlatformType},
		{name: "podman agent", endpoint: portainer.Endpoint{Type: portainer.AgentOnDockerEnvironment, ContainerEngine: portainer.ContainerEnginePodman}, want: portainer.PodmanPlatformType},
		{name: "kubernetes local", endpoint: portainer.Endpoint{Type: portainer.KubernetesLocalEnvironment}, want: portainer.KubernetesPlatformType},
		{name: "kubernetes agent", endpoint: portainer.Endpoint{Type: portainer.AgentOnKubernetesEnvironment}, want: portainer.KubernetesPlatformType},
		{name: "kubernetes edge", endpoint: portainer.Endpoint{Type: portainer.EdgeAgentOnKubernetesEnvironment}, want: portainer.KubernetesPlatformType},
		{name: "azure", endpoint: portainer.Endpoint{Type: portainer.AzureEnvironment}, want: portainer.AzurePlatformType},
		{name: "unknown type", endpoint: portainer.Endpoint{Type: portainer.EndpointType(99)}, want: portainer.UnknownPlatformType},
		{name: "docker engine string stays docker", endpoint: portainer.Endpoint{Type: portainer.DockerEnvironment, ContainerEngine: portainer.ContainerEngineDocker}, want: portainer.DockerPlatformType},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tt.want, EndpointPlatformType(&tt.endpoint))
		})
	}
}

func Test_FilterByExcludeIDs(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name            string
		inputArray      []portainer.Endpoint
		inputExcludeIDs []portainer.EndpointID
		asserts         func(*testing.T, []portainer.Endpoint)
	}{
		{
			name: "filter endpoints",
			inputArray: []portainer.Endpoint{
				{ID: portainer.EndpointID(1)},
				{ID: portainer.EndpointID(2)},
				{ID: portainer.EndpointID(3)},
				{ID: portainer.EndpointID(4)},
			},
			inputExcludeIDs: []portainer.EndpointID{
				portainer.EndpointID(2),
				portainer.EndpointID(3),
			},
			asserts: func(t *testing.T, output []portainer.Endpoint) {
				assert.Contains(t, output, portainer.Endpoint{ID: portainer.EndpointID(1)})
				assert.NotContains(t, output, portainer.Endpoint{ID: portainer.EndpointID(2)})
				assert.NotContains(t, output, portainer.Endpoint{ID: portainer.EndpointID(3)})
				assert.Contains(t, output, portainer.Endpoint{ID: portainer.EndpointID(4)})
			},
		},
		{
			name:       "empty input",
			inputArray: []portainer.Endpoint{},
			inputExcludeIDs: []portainer.EndpointID{
				portainer.EndpointID(2),
			},
			asserts: func(t *testing.T, output []portainer.Endpoint) {
				assert.Empty(t, output)
			},
		},
		{
			name: "no filter",
			inputArray: []portainer.Endpoint{
				{ID: portainer.EndpointID(1)},
				{ID: portainer.EndpointID(2)},
			},
			inputExcludeIDs: []portainer.EndpointID{},
			asserts: func(t *testing.T, output []portainer.Endpoint) {
				assert.Len(t, output, 2)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			output := FilterByExcludeIDs(tt.inputArray, tt.inputExcludeIDs)
			tt.asserts(t, output)
		})
	}
}

func TestUpdateEdgeEndpointHeartbeat(t *testing.T) {
	t.Parallel()
	endpoint := &portainer.Endpoint{
		Type:                portainer.EdgeAgentOnDockerEnvironment,
		LastCheckInDate:     time.Now().Unix(),
		EdgeCheckinInterval: 5,
	}

	UpdateEdgeEndpointHeartbeat(endpoint, &portainer.Settings{})
	require.True(t, endpoint.Heartbeat)

	endpoint.LastCheckInDate = time.Now().Add(-time.Minute).Unix()
	UpdateEdgeEndpointHeartbeat(endpoint, &portainer.Settings{})
	require.False(t, endpoint.Heartbeat)

	local := &portainer.Endpoint{
		Type:      portainer.DockerEnvironment,
		Heartbeat: true,
	}
	UpdateEdgeEndpointHeartbeat(local, &portainer.Settings{})
	require.True(t, local.Heartbeat, "non-edge endpoints keep existing heartbeat flag")
}

func TestGetEndpointCheckinInterval(t *testing.T) {
	t.Parallel()

	t.Run("sync uses endpoint interval", func(t *testing.T) {
		t.Parallel()
		interval := getEndpointCheckinInterval(&portainer.Endpoint{
			EdgeCheckinInterval: 15,
		}, &portainer.Settings{EdgeAgentCheckinInterval: 60})
		assert.Equal(t, 15, interval)
	})

	t.Run("sync falls back to settings", func(t *testing.T) {
		t.Parallel()
		interval := getEndpointCheckinInterval(&portainer.Endpoint{
			EdgeCheckinInterval: 0,
		}, &portainer.Settings{EdgeAgentCheckinInterval: 42})
		assert.Equal(t, 42, interval)
	})

	t.Run("async picks smallest positive interval", func(t *testing.T) {
		t.Parallel()
		interval := getEndpointCheckinInterval(&portainer.Endpoint{
			Edge: portainer.EnvironmentEdgeSettings{
				AsyncMode:        true,
				PingInterval:     0,
				CommandInterval:  30,
				SnapshotInterval: 90,
			},
		}, &portainer.Settings{
			Edge: portainer.Edge{
				PingInterval:     10,
				CommandInterval:  0,
				SnapshotInterval: 120,
			},
		})
		assert.Equal(t, 10, interval)
	})

	t.Run("async defaults to sixty when all non-positive", func(t *testing.T) {
		t.Parallel()
		interval := getEndpointCheckinInterval(&portainer.Endpoint{
			Edge: portainer.EnvironmentEdgeSettings{AsyncMode: true},
		}, &portainer.Settings{})
		assert.Equal(t, 60, interval)
	})

	t.Run("async endpoint interval overrides settings when smaller", func(t *testing.T) {
		t.Parallel()
		interval := getEndpointCheckinInterval(&portainer.Endpoint{
			Edge: portainer.EnvironmentEdgeSettings{
				AsyncMode:        true,
				PingInterval:     5,
				CommandInterval:  20,
				SnapshotInterval: 20,
			},
		}, &portainer.Settings{
			Edge: portainer.Edge{PingInterval: 50, CommandInterval: 50, SnapshotInterval: 50},
		})
		assert.Equal(t, 5, interval)
	})
}

type relationService struct {
	dataservices.EndpointRelationService
	created []*portainer.EndpointRelation
	err     error
}

func (s *relationService) Create(relation *portainer.EndpointRelation) error {
	if s.err != nil {
		return s.err
	}
	s.created = append(s.created, relation)
	return nil
}

type relationStore struct {
	dataservices.DataStoreTx
	relations *relationService
}

func (s *relationStore) EndpointRelation() dataservices.EndpointRelationService {
	return s.relations
}

func TestInitializeEdgeEndpointRelation(t *testing.T) {
	t.Parallel()

	t.Run("non-edge is no-op", func(t *testing.T) {
		t.Parallel()
		svc := &relationService{}
		err := InitializeEdgeEndpointRelation(&portainer.Endpoint{
			ID:   1,
			Type: portainer.DockerEnvironment,
		}, &relationStore{relations: svc})
		require.NoError(t, err)
		assert.Empty(t, svc.created)
	})

	t.Run("edge creates empty stack map", func(t *testing.T) {
		t.Parallel()
		svc := &relationService{}
		err := InitializeEdgeEndpointRelation(&portainer.Endpoint{
			ID:   9,
			Type: portainer.EdgeAgentOnDockerEnvironment,
		}, &relationStore{relations: svc})
		require.NoError(t, err)
		require.Len(t, svc.created, 1)
		assert.Equal(t, portainer.EndpointID(9), svc.created[0].EndpointID)
		assert.NotNil(t, svc.created[0].EdgeStacks)
		assert.Empty(t, svc.created[0].EdgeStacks)
	})

	t.Run("create error propagates", func(t *testing.T) {
		t.Parallel()
		svc := &relationService{err: errors.New("relation create failed")}
		err := InitializeEdgeEndpointRelation(&portainer.Endpoint{
			ID:   2,
			Type: portainer.EdgeAgentOnKubernetesEnvironment,
		}, &relationStore{relations: svc})
		assert.EqualError(t, err, "relation create failed")
	})
}

func TestEndpointSet(t *testing.T) {
	t.Parallel()
	got := EndpointSet([]portainer.EndpointID{1, 2, 2, 3})
	assert.True(t, got[1])
	assert.True(t, got[2])
	assert.True(t, got[3])
	assert.False(t, got[4])
}

type updatingEndpointService struct {
	dataservices.EndpointService
	updated []*portainer.Endpoint
	err     error
}

func (s *updatingEndpointService) UpdateEndpoint(id portainer.EndpointID, endpoint *portainer.Endpoint) error {
	if s.err != nil {
		return s.err
	}
	cp := *endpoint
	s.updated = append(s.updated, &cp)
	return nil
}

type updatingStore struct {
	dataservices.DataStoreTx
	endpoint dataservices.EndpointService
}

func (s *updatingStore) Endpoint() dataservices.EndpointService { return s.endpoint }

func TestInitialDetections_AlreadyDetectedEarlyReturn(t *testing.T) {
	t.Parallel()

	svc := &updatingEndpointService{}
	store := &updatingStore{endpoint: svc}

	endpoint := &portainer.Endpoint{
		ID: 1,
		Kubernetes: portainer.KubernetesData{
			Flags: portainer.KubernetesFlags{
				IsServerIngressClassDetected: true,
				IsServerMetricsDetected:      true,
				IsServerStorageDetected:      true,
			},
		},
	}

	InitialIngressClassDetection(store, endpoint, nil)
	InitialMetricsDetection(store, endpoint, nil)
	err := storageDetect(store, endpoint, nil)
	require.NoError(t, err)
	assert.Empty(t, svc.updated, "already-detected flags must skip client work and updates")
}
