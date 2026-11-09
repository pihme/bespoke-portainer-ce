package extension_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices/extension"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

func TestBucketName(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	require.Equal(t, "extension", store.ExtensionService.BucketName())
	require.Equal(t, extension.BucketName, store.ExtensionService.BucketName())
}

func TestNewServiceUsesConnection(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc, err := extension.NewService(store.GetConnection())
	require.NoError(t, err)
	require.NotNil(t, svc)
	require.Equal(t, extension.BucketName, svc.BucketName())
}

// TestPersistExtensionReadListAndDelete covers Persist, Extension, Extensions,
// and DeleteExtension for the deprecated extension datastore.
func TestPersistExtensionReadListAndDelete(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	svc := store.ExtensionService

	_, err := svc.Extension(1)
	require.Error(t, err)

	list, err := svc.Extensions()
	require.NoError(t, err)
	require.Empty(t, list)

	ext := &portainer.Extension{
		ID:      1,
		Enabled: true,
		Name:    "legacy-ext",
		Version: "1.0.0",
	}
	require.NoError(t, svc.Persist(ext))

	got, err := svc.Extension(1)
	require.NoError(t, err)
	require.Equal(t, portainer.ExtensionID(1), got.ID)
	require.True(t, got.Enabled)
	require.Equal(t, "legacy-ext", got.Name)
	require.Equal(t, "1.0.0", got.Version)

	ext2 := &portainer.Extension{
		ID:      2,
		Enabled: false,
		Name:    "other-ext",
		Version: "2.0.0",
	}
	require.NoError(t, svc.Persist(ext2))

	list, err = svc.Extensions()
	require.NoError(t, err)
	require.Len(t, list, 2)
	ids := map[portainer.ExtensionID]bool{}
	for _, e := range list {
		ids[e.ID] = true
	}
	require.True(t, ids[1])
	require.True(t, ids[2])

	require.NoError(t, svc.DeleteExtension(1))
	_, err = svc.Extension(1)
	require.Error(t, err)

	list, err = svc.Extensions()
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, portainer.ExtensionID(2), list[0].ID)
}
