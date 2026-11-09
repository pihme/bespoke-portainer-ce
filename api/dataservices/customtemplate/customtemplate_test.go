package customtemplate_test

import (
	"errors"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices/customtemplate"
	"github.com/portainer/portainer/api/datastore"
	"github.com/stretchr/testify/require"
)

func TestCustomTemplateCreate(t *testing.T) {
	t.Parallel()
	_, ds := datastore.MustNewTestStore(t, false, false)
	require.NotNil(t, ds)

	require.NoError(t, ds.CustomTemplate().Create(&portainer.CustomTemplate{ID: 1}))
	e, err := ds.CustomTemplate().Read(1)
	require.NoError(t, err)
	require.Equal(t, portainer.CustomTemplateID(1), e.ID)
}

func TestGetNextIdentifier(t *testing.T) {
	t.Parallel()
	_, ds := datastore.MustNewTestStore(t, false, false)

	id1 := ds.CustomTemplate().GetNextIdentifier()
	id2 := ds.CustomTemplate().GetNextIdentifier()
	require.Greater(t, id2, id1)
}

func TestNewService_SetServiceNameError(t *testing.T) {
	t.Parallel()

	conn := &failingSetServiceNameConn{err: errors.New("set service name failed")}
	svc, err := customtemplate.NewService(conn)
	require.Error(t, err)
	require.Nil(t, svc)
}

type failingSetServiceNameConn struct {
	portainer.Connection
	err error
}

func (c *failingSetServiceNameConn) SetServiceName(string) error {
	return c.err
}
