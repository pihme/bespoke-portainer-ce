package tag_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices/tag"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

func TestNewService(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc, err := tag.NewService(store.GetConnection())
	require.NoError(t, err)
	require.NotNil(t, svc)
	require.Equal(t, tag.BucketName, svc.Bucket)
}

// TestCreateReadUpdateTagFuncAndDelete covers Create, UpdateTagFunc, and
// base Read/Delete for local environment tags.
func TestCreateReadUpdateTagFuncAndDelete(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc := store.Tag()

	tagObj := &portainer.Tag{
		Name:           "local",
		Endpoints:      map[portainer.EndpointID]bool{},
		EndpointGroups: map[portainer.EndpointGroupID]bool{},
	}
	require.NoError(t, svc.Create(tagObj))
	require.NotZero(t, tagObj.ID)

	got, err := svc.Read(tagObj.ID)
	require.NoError(t, err)
	require.Equal(t, "local", got.Name)

	require.NoError(t, svc.UpdateTagFunc(tagObj.ID, func(tg *portainer.Tag) {
		tg.Name = "local-renamed"
		tg.Endpoints[portainer.EndpointID(1)] = true
	}))

	updated, err := svc.Read(tagObj.ID)
	require.NoError(t, err)
	require.Equal(t, "local-renamed", updated.Name)
	require.True(t, updated.Endpoints[1])

	all, err := svc.ReadAll()
	require.NoError(t, err)
	require.NotEmpty(t, all)

	require.NoError(t, svc.Delete(tagObj.ID))
	_, err = svc.Read(tagObj.ID)
	require.Error(t, err)
}
