package platform

import (
	"errors"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/internal/testhelpers"

	"github.com/stretchr/testify/require"
)

type endpointErrStore struct {
	dataservices.DataStore
	endpoint dataservices.EndpointService
}

func (s endpointErrStore) Endpoint() dataservices.EndpointService { return s.endpoint }

type endpointErrService struct {
	dataservices.EndpointService
	err error
}

func (s endpointErrService) Endpoints() ([]portainer.Endpoint, error) {
	return nil, s.err
}

func TestDetermineContainerPlatform_DefaultOutsideContainer(t *testing.T) {
	t.Setenv(PodmanMode, "")
	t.Setenv(KubernetesServiceHost, "")

	// Without /.dockerenv the process is treated as not running in a container.
	require.Equal(t, ContainerPlatform(""), DetermineContainerPlatform())
	require.False(t, isRunningInContainer())
}

func TestDetectLocalEnvironment_EndpointsError(t *testing.T) {
	t.Setenv(KubernetesServiceHost, "10.96.0.1")
	t.Setenv(PodmanMode, "")

	base := testhelpers.NewDatastore(testhelpers.WithEndpoints([]portainer.Endpoint{
		{ID: 1, Type: portainer.KubernetesLocalEnvironment},
	}))
	wantErr := errors.New("endpoint list boom")
	ds := endpointErrStore{
		DataStore: base,
		endpoint: endpointErrService{
			EndpointService: base.Endpoint(),
			err:             wantErr,
		},
	}

	_, _, err := detectLocalEnvironment(ds)
	require.ErrorIs(t, err, wantErr)
}

func TestService_GetLocalEnvironmentAndPlatformErrors(t *testing.T) {
	t.Setenv(KubernetesServiceHost, "10.96.0.1")
	t.Setenv(PodmanMode, "")

	ds := testhelpers.NewDatastore(testhelpers.WithEndpoints([]portainer.Endpoint{
		{ID: 1, Type: portainer.DockerEnvironment, URL: "tcp://192.168.1.100:2376"},
	}))
	svc := NewService(ds)

	_, err := svc.GetLocalEnvironment()
	require.ErrorIs(t, err, ErrNoLocalEnvironment)

	svc2 := NewService(ds)
	_, err = svc2.GetPlatform()
	require.ErrorIs(t, err, ErrNoLocalEnvironment)
}

func TestService_GetPlatformCachesAfterLoad(t *testing.T) {
	t.Setenv(KubernetesServiceHost, "10.96.0.1")
	t.Setenv(PodmanMode, "")

	kube := portainer.Endpoint{ID: 1, Type: portainer.KubernetesLocalEnvironment}
	ds := testhelpers.NewDatastore(testhelpers.WithEndpoints([]portainer.Endpoint{kube}))
	svc := NewService(ds)

	p1, err := svc.GetPlatform()
	require.NoError(t, err)
	p2, err := svc.GetPlatform()
	require.NoError(t, err)
	require.Equal(t, p1, p2)
	require.Equal(t, PlatformKubernetes, p2)
}
