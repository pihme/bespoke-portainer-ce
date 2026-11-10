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

// TestCreateReadUpdateAndDelete covers Create and the base Read, Update and
// Delete the 1.24 migration and the backup export rely on.
func TestCreateReadUpdateAndDelete(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc := store.TagService

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

	got.Name = "local-renamed"
	got.Endpoints[portainer.EndpointID(1)] = true
	require.NoError(t, svc.Update(got.ID, got))

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
