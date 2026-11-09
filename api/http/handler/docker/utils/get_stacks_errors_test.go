package utils

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/security"

	"github.com/stretchr/testify/require"
)

func TestGetDockerStacks_UserNotFound(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)

	err := store.ViewTx(func(tx dataservices.DataStoreTx) error {
		_, err := GetDockerStacks(tx, &security.RestrictedRequestContext{UserID: 999}, 1, nil, nil)
		require.Error(t, err)
		require.Contains(t, err.Error(), "Unable to retrieve user")
		return nil
	})
	require.NoError(t, err)
}

func TestGetDockerStacks_StackReadError(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	require.NoError(t, store.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole}))

	// Closing the underlying connection makes subsequent tx reads fail.
	require.NoError(t, store.Close())

	err := store.ViewTx(func(tx dataservices.DataStoreTx) error {
		_, err := GetDockerStacks(tx, &security.RestrictedRequestContext{UserID: 1}, 1, nil, nil)
		if err != nil {
			require.Contains(t, err.Error(), "Unable to retrieve")
		}
		return err
	})
	require.Error(t, err)
}
