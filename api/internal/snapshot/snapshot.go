package snapshot

import (
	"context"
	"errors"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"

	"github.com/rs/zerolog/log"
)

// Service represents a service to manage environment(endpoint) snapshots.
// It provides an interface to start background snapshots as well as
// specific Docker environment(endpoint) snapshot methods.
type Service struct {
	dataStore                 dataservices.DataStore
	snapshotIntervalCh        chan time.Duration
	snapshotIntervalInSeconds float64
	dockerSnapshotter         portainer.DockerSnapshotter
}

// NewService creates a new instance of a service
func NewService(
	snapshotIntervalFromFlag string,
	dataStore dataservices.DataStore,
	dockerSnapshotter portainer.DockerSnapshotter,
) (*Service, error) {
	interval, err := parseSnapshotFrequency(snapshotIntervalFromFlag, dataStore)
	if err != nil {
		return nil, err
	}

	return &Service{
		dataStore:                 dataStore,
		snapshotIntervalCh:        make(chan time.Duration),
		snapshotIntervalInSeconds: interval,
		dockerSnapshotter:         dockerSnapshotter,
	}, nil
}

func parseSnapshotFrequency(snapshotInterval string, dataStore dataservices.DataStore) (float64, error) {
	if snapshotInterval == "" {
		settings, err := dataStore.Settings().Settings()
		if err != nil {
			return 0, err
		}

		snapshotInterval = settings.SnapshotInterval
		if snapshotInterval == "" {
			snapshotInterval = portainer.DefaultSnapshotInterval
		}
	}

	snapshotFrequency, err := time.ParseDuration(snapshotInterval)
	if err != nil {
		return 0, err
	}

	return snapshotFrequency.Seconds(), nil
}

// Start will start a background routine to execute periodic snapshots of environments(endpoints)
func (service *Service) Start(ctx context.Context) {
	go service.startSnapshotLoop(ctx)
}

// SetSnapshotInterval sets the snapshot interval and resets the service
func (service *Service) SetSnapshotInterval(snapshotInterval string) error {
	interval, err := time.ParseDuration(snapshotInterval)
	if err != nil {
		return err
	}

	service.snapshotIntervalCh <- interval

	return nil
}

// SupportDirectSnapshot checks whether an environment(endpoint) can be used to trigger a direct a snapshot.
// It is mostly true for all environments(endpoints) except Edge and Azure environments(endpoints).
func SupportDirectSnapshot(endpoint *portainer.Endpoint) bool {
	switch endpoint.Type {
	case portainer.EdgeAgentOnDockerEnvironment, portainer.EdgeAgentOnKubernetesEnvironment, portainer.AzureEnvironment:
		return false
	case portainer.AgentOnDockerEnvironment, portainer.AgentOnKubernetesEnvironment:
		return false
	}

	return true
}

// SnapshotEndpoint will create a snapshot of the environment(endpoint) based on the environment(endpoint) type.
// If the snapshot is a success, it will be associated to the environment(endpoint).
func (service *Service) SnapshotEndpoint(endpoint *portainer.Endpoint) error {
	return service.SnapshotEndpointTx(service.dataStore, endpoint)
}

func (service *Service) SnapshotEndpointTx(tx dataservices.DataStoreTx, endpoint *portainer.Endpoint) error {
	// The Portainer Agent is removed (TAI-007): a legacy Agent environment is not dialled.
	if portainer.IsAgentEnvironmentType(endpoint.Type) {
		return portainer.ErrAgentEnvironmentNotSupported
	}

	switch endpoint.Type {
	// Kubernetes is removed (TAI-002) and no Kubernetes environment can be
	// created, so leftover Kubernetes and Azure records are not snapshotted.
	case portainer.AzureEnvironment, portainer.KubernetesLocalEnvironment, portainer.AgentOnKubernetesEnvironment, portainer.EdgeAgentOnKubernetesEnvironment:
		return nil
	}

	return service.snapshotDockerEndpoint(tx, endpoint)
}

func (service *Service) Create(snapshot portainer.Snapshot) error {
	return service.dataStore.Snapshot().Create(&snapshot)
}

func (service *Service) FillSnapshotData(endpoint *portainer.Endpoint, includeRaw bool) error {
	return FillSnapshotData(service.dataStore, endpoint, includeRaw)
}

func (service *Service) snapshotDockerEndpoint(tx dataservices.DataStoreTx, endpoint *portainer.Endpoint) error {
	dockerSnapshot, err := service.dockerSnapshotter.CreateSnapshot(endpoint)
	if err != nil {
		return err
	}

	if err := validateContainerEngineCompatibility(endpoint, dockerSnapshot); err != nil {
		return err
	}

	if dockerSnapshot != nil {
		snapshot := &portainer.Snapshot{EndpointID: endpoint.ID, Docker: dockerSnapshot}

		return tx.Snapshot().Create(snapshot)
	}

	return nil
}

func validateContainerEngineCompatibility(endpoint *portainer.Endpoint, dockerSnapshot *portainer.DockerSnapshot) error {
	if endpoint.ContainerEngine == portainer.ContainerEngineDocker && dockerSnapshot.IsPodman {
		return errors.New("the Docker environment option doesn't support Podman environments. Please select the Podman option instead.")
	}
	if endpoint.ContainerEngine == portainer.ContainerEnginePodman && !dockerSnapshot.IsPodman {
		return errors.New("the Podman environment option doesn't support Docker environments. Please select the Docker option instead.")
	}
	return nil
}

func (service *Service) startSnapshotLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(service.snapshotIntervalInSeconds) * time.Second)

	err := service.snapshotEndpoints()
	if err != nil {
		log.Error().Err(err).Msg("background schedule error (environment snapshot)")
	}

	for {
		select {
		case <-ticker.C:
			err := service.snapshotEndpoints()
			if err != nil {
				log.Error().Err(err).Msg("background schedule error (environment snapshot)")
			}
		case <-ctx.Done():
			log.Debug().Msg("shutting down snapshotting")
			ticker.Stop()

			return
		case interval := <-service.snapshotIntervalCh:
			ticker.Reset(interval)
		}
	}
}

func (service *Service) snapshotEndpoints() error {
	endpoints, err := service.dataStore.Endpoint().Endpoints()
	if err != nil {
		return err
	}

	for _, endpoint := range endpoints {
		if !SupportDirectSnapshot(&endpoint) || endpoint.URL == "" {
			continue
		}

		snapshotError := service.SnapshotEndpoint(&endpoint)

		if err := service.dataStore.UpdateTx(func(tx dataservices.DataStoreTx) error {
			updateEndpointStatus(tx, &endpoint, snapshotError)

			return nil
		}); err != nil {
			log.Error().
				Err(err).
				Int("endpoint_id", int(endpoint.ID)).
				Msg("unable to update environment status")
		}
	}

	return nil
}

func updateEndpointStatus(tx dataservices.DataStoreTx, endpoint *portainer.Endpoint, snapshotError error) {
	latestEndpointReference, err := tx.Endpoint().Endpoint(endpoint.ID)
	if latestEndpointReference == nil {
		log.Debug().
			Str("endpoint", endpoint.Name).
			Str("URL", endpoint.URL).Err(err).
			Msg("background schedule error (environment snapshot), environment not found inside the database anymore")

		return
	}

	latestEndpointReference.Status = portainer.EndpointStatusUp

	if snapshotError != nil {
		log.Debug().
			Str("endpoint", endpoint.Name).
			Str("URL", endpoint.URL).Err(snapshotError).
			Msg("background schedule error (environment snapshot), unable to create snapshot")

		latestEndpointReference.Status = portainer.EndpointStatusDown
	}

	latestEndpointReference.Agent.Version = endpoint.Agent.Version

	if err := tx.Endpoint().UpdateEndpoint(latestEndpointReference.ID, latestEndpointReference); err != nil {
		log.Debug().
			Str("endpoint", endpoint.Name).
			Str("URL", endpoint.URL).Err(err).
			Msg("background schedule error (environment snapshot), unable to update environment")
	}
}

// FetchDockerID fetches info.Swarm.Cluster.ID if environment(endpoint) is swarm and info.ID otherwise
func FetchDockerID(snapshot portainer.DockerSnapshot) (string, error) {
	info := snapshot.SnapshotRaw.Info

	if !snapshot.Swarm {
		return info.ID, nil
	}

	if info.Swarm.Cluster == nil {
		return "", errors.New("swarm environment is missing cluster info snapshot")
	}

	return info.Swarm.Cluster.ID, nil
}

func FillSnapshotData(tx dataservices.DataStoreTx, endpoint *portainer.Endpoint, includeRaw bool) error {
	var snapshot *portainer.Snapshot
	var err error

	if includeRaw {
		snapshot, err = tx.Snapshot().Read(endpoint.ID)
	} else {
		snapshot, err = tx.Snapshot().ReadWithoutSnapshotRaw(endpoint.ID)
	}

	if tx.IsErrObjectNotFound(err) {
		endpoint.Snapshots = []portainer.DockerSnapshot{}
		endpoint.Kubernetes.Snapshots = []portainer.KubernetesSnapshot{}

		return nil
	} else if err != nil {
		return err
	}

	if snapshot.Docker != nil {
		endpoint.Snapshots = []portainer.DockerSnapshot{*snapshot.Docker}
	}

	if snapshot.Kubernetes != nil {
		endpoint.Kubernetes.Snapshots = []portainer.KubernetesSnapshot{*snapshot.Kubernetes}
	}

	return nil
}
