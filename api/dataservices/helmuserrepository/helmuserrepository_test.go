package helmuserrepository_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices/helmuserrepository"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

func TestNewService(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc, err := helmuserrepository.NewService(store.GetConnection())
	require.NoError(t, err)
	require.NotNil(t, svc)
	require.Equal(t, helmuserrepository.BucketName, svc.Bucket)
}

func TestCreateReadFilterByUserAndDelete(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc := store.HelmUserRepository()

	empty, err := svc.HelmUserRepositoryByUserID(1)
	require.NoError(t, err)
	require.Empty(t, empty)

	repo1 := &portainer.HelmUserRepository{UserID: 1, URL: "https://charts.example.com/a"}
	require.NoError(t, svc.Create(repo1))
	require.NotZero(t, repo1.ID)

	repo2 := &portainer.HelmUserRepository{UserID: 2, URL: "https://charts.example.com/b"}
	require.NoError(t, svc.Create(repo2))

	repo3 := &portainer.HelmUserRepository{UserID: 1, URL: "https://charts.example.com/c"}
	require.NoError(t, svc.Create(repo3))

	forUser1, err := svc.HelmUserRepositoryByUserID(1)
	require.NoError(t, err)
	require.Len(t, forUser1, 2)
	urls := map[string]bool{}
	for _, r := range forUser1 {
		urls[r.URL] = true
		require.Equal(t, portainer.UserID(1), r.UserID)
	}
	require.True(t, urls["https://charts.example.com/a"])
	require.True(t, urls["https://charts.example.com/c"])

	got, err := svc.Read(repo1.ID)
	require.NoError(t, err)
	require.Equal(t, "https://charts.example.com/a", got.URL)

	require.NoError(t, svc.Delete(repo1.ID))
	_, err = svc.Read(repo1.ID)
	require.Error(t, err)

	forUser1, err = svc.HelmUserRepositoryByUserID(1)
	require.NoError(t, err)
	require.Len(t, forUser1, 1)
	require.Equal(t, "https://charts.example.com/c", forUser1[0].URL)
}
