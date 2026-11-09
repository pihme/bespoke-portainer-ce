package endpoint_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

// TestREQ_ENV_03_TxCreateReadUpdateDeleteLocalDockerEndpoint covers the
// transactional CRUD path for a local Docker environment.
func TestREQ_ENV_03_TxCreateReadUpdateDeleteLocalDockerEndpoint(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	var id portainer.EndpointID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		id = portainer.EndpointID(tx.Endpoint().GetNextIdentifier())
		return tx.Endpoint().Create(localDockerEndpoint(id, "tx-local", "unix:///var/run/docker.sock"))
	}))

	var got *portainer.Endpoint
	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		var err error
		got, err = tx.Endpoint().Endpoint(id)
		return err
	}))
	require.Equal(t, "tx-local", got.Name)
	require.Equal(t, "unix:///var/run/docker.sock", got.URL)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		got.Name = "tx-local-renamed"
		got.URL = "tcp://127.0.0.1:2375"
		return tx.Endpoint().UpdateEndpoint(id, got)
	}))

	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		var err error
		got, err = tx.Endpoint().Endpoint(id)
		return err
	}))
	require.Equal(t, "tx-local-renamed", got.Name)
	require.Equal(t, "tcp://127.0.0.1:2375", got.URL)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.Endpoint().DeleteEndpoint(id)
	}))

	err := store.ViewTx(func(tx dataservices.DataStoreTx) error {
		_, err := tx.Endpoint().Endpoint(id)
		return err
	})
	require.Error(t, err)
}

func TestREQ_ENV_01_TxEndpointsAndReadAll(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		id1 := portainer.EndpointID(tx.Endpoint().GetNextIdentifier())
		if err := tx.Endpoint().Create(localDockerEndpoint(id1, "tx-a", "unix:///var/run/docker.sock")); err != nil {
			return err
		}
		id2 := portainer.EndpointID(tx.Endpoint().GetNextIdentifier())
		return tx.Endpoint().Create(localDockerEndpoint(id2, "tx-b", "tcp://127.0.0.1:2375"))
	}))

	var all []portainer.Endpoint
	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		var err error
		all, err = tx.Endpoint().Endpoints()
		return err
	}))
	require.Len(t, all, 2)

	var filtered []portainer.Endpoint
	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		var err error
		filtered, err = tx.Endpoint().ReadAll(func(e portainer.Endpoint) bool {
			return e.URL == "unix:///var/run/docker.sock"
		})
		return err
	}))
	require.Len(t, filtered, 1)
	require.Equal(t, "tx-a", filtered[0].Name)
}

func TestREQ_ENV_03_TxEndpointsByTeamID(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	teamID := portainer.TeamID(3)
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		id := portainer.EndpointID(tx.Endpoint().GetNextIdentifier())
		ep := localDockerEndpoint(id, "team-ep", "unix:///var/run/docker.sock")
		ep.TeamAccessPolicies = portainer.TeamAccessPolicies{
			teamID: {RoleID: 1},
		}
		if err := tx.Endpoint().Create(ep); err != nil {
			return err
		}
		other := portainer.EndpointID(tx.Endpoint().GetNextIdentifier())
		return tx.Endpoint().Create(localDockerEndpoint(other, "no-team", "tcp://127.0.0.1:2375"))
	}))

	var matched []portainer.Endpoint
	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		var err error
		matched, err = tx.Endpoint().EndpointsByTeamID(teamID)
		return err
	}))
	require.Len(t, matched, 1)
	require.Equal(t, "team-ep", matched[0].Name)
}

func TestREQ_ENV_03_TxBucketNameAndStubs(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		require.Equal(t, "endpoints", tx.Endpoint().BucketName())

		id, ok := tx.Endpoint().EndpointIDByEdgeID("any")
		require.False(t, ok)
		require.Equal(t, portainer.EndpointID(0), id)

		ts, ok := tx.Endpoint().Heartbeat(1)
		require.False(t, ok)
		require.Equal(t, int64(0), ts)

		tx.Endpoint().UpdateHeartbeat(1)
		return nil
	}))
}

func TestREQ_ENV_03_TxEndpointMissingReturnsError(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	err := store.ViewTx(func(tx dataservices.DataStoreTx) error {
		_, err := tx.Endpoint().Endpoint(portainer.EndpointID(404))
		return err
	})
	require.Error(t, err)
}
