package endpointrelation

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/database/boltdb"
	"github.com/portainer/portainer/api/dataservices/edgestack"
	"github.com/portainer/portainer/api/internal/edge/cache"
	"github.com/portainer/portainer/api/logs"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateRelation(t *testing.T) {
	t.Parallel()
	const endpointID = 1
	const edgeStackID1 = 1
	const edgeStackID2 = 2

	var conn portainer.Connection = &boltdb.DbConnection{Path: t.TempDir()}
	err := conn.Open()
	require.NoError(t, err)

	defer logs.CloseAndLogErr(conn)

	service, err := NewService(conn)
	require.NoError(t, err)

	updateStackFnTxCalled := false

	edgeStacks := make(map[portainer.EdgeStackID]portainer.EdgeStack)
	edgeStacks[edgeStackID1] = portainer.EdgeStack{ID: edgeStackID1}
	edgeStacks[edgeStackID2] = portainer.EdgeStack{ID: edgeStackID2}

	service.RegisterUpdateStackFunction(func(tx portainer.Transaction, ID portainer.EdgeStackID, updateFunc func(edgeStack *portainer.EdgeStack)) error {
		updateStackFnTxCalled = true

		s, ok := edgeStacks[ID]
		require.True(t, ok)

		updateFunc(&s)
		edgeStacks[ID] = s

		return nil
	})

	// Nil relation

	cache.Set(endpointID, []byte("value"))

	err = service.UpdateEndpointRelation(endpointID, nil)
	_, cacheKeyExists := cache.Get(endpointID)
	require.NoError(t, err)
	require.False(t, updateStackFnTxCalled)
	require.False(t, cacheKeyExists)

	// Add a relation to two edge stacks

	cache.Set(endpointID, []byte("value"))

	err = service.UpdateEndpointRelation(endpointID, &portainer.EndpointRelation{
		EndpointID: endpointID,
		EdgeStacks: map[portainer.EdgeStackID]bool{
			edgeStackID1: true,
			edgeStackID2: true,
		},
	})
	_, cacheKeyExists = cache.Get(endpointID)
	require.NoError(t, err)
	require.True(t, updateStackFnTxCalled)
	require.False(t, cacheKeyExists)
	require.Equal(t, 1, edgeStacks[edgeStackID1].NumDeployments)
	require.Equal(t, 1, edgeStacks[edgeStackID2].NumDeployments)

	// Remove a relation to one edge stack

	updateStackFnTxCalled = false
	cache.Set(endpointID, []byte("value"))

	err = service.UpdateEndpointRelation(endpointID, &portainer.EndpointRelation{
		EndpointID: endpointID,
		EdgeStacks: map[portainer.EdgeStackID]bool{
			2: true,
		},
	})
	_, cacheKeyExists = cache.Get(endpointID)
	require.NoError(t, err)
	require.True(t, updateStackFnTxCalled)
	require.False(t, cacheKeyExists)
	require.Equal(t, 0, edgeStacks[edgeStackID1].NumDeployments)
	require.Equal(t, 1, edgeStacks[edgeStackID2].NumDeployments)

	// Delete the relation

	updateStackFnTxCalled = false
	cache.Set(endpointID, []byte("value"))

	err = service.DeleteEndpointRelation(endpointID)

	_, cacheKeyExists = cache.Get(endpointID)
	require.NoError(t, err)
	require.True(t, updateStackFnTxCalled)
	require.False(t, cacheKeyExists)
	require.Equal(t, 0, edgeStacks[edgeStackID1].NumDeployments)
	require.Equal(t, 0, edgeStacks[edgeStackID2].NumDeployments)
}

func TestAddEndpointRelationsForEdgeStack(t *testing.T) {
	t.Parallel()
	var conn portainer.Connection = &boltdb.DbConnection{Path: t.TempDir()}
	err := conn.Open()
	require.NoError(t, err)

	defer logs.CloseAndLogErr(conn)

	service, err := NewService(conn)
	require.NoError(t, err)

	edgeStackService, err := edgestack.NewService(conn, func(t portainer.Transaction, esi portainer.EdgeStackID) {})
	require.NoError(t, err)

	service.RegisterUpdateStackFunction(edgeStackService.UpdateEdgeStackFuncTx)
	require.NoError(t, edgeStackService.Create(1, &portainer.EdgeStack{}))
	require.NoError(t, service.Create(&portainer.EndpointRelation{EndpointID: 1, EdgeStacks: map[portainer.EdgeStackID]bool{}}))
	require.NoError(t, service.AddEndpointRelationsForEdgeStack([]portainer.EndpointID{1}, &portainer.EdgeStack{ID: 1}))
}

func TestEndpointRelations(t *testing.T) {
	t.Parallel()
	var conn portainer.Connection = &boltdb.DbConnection{Path: t.TempDir()}
	err := conn.Open()
	require.NoError(t, err)

	defer logs.CloseAndLogErr(conn)

	service, err := NewService(conn)
	require.NoError(t, err)

	require.NoError(t, service.Create(&portainer.EndpointRelation{EndpointID: 1}))
	rels, err := service.EndpointRelations()
	require.NoError(t, err)
	require.Len(t, rels, 1)
}

func openRelationService(t *testing.T) (portainer.Connection, *Service) {
	t.Helper()
	conn := &boltdb.DbConnection{Path: t.TempDir()}
	require.NoError(t, conn.Open())
	t.Cleanup(func() { logs.CloseAndLogErr(conn) })

	svc, err := NewService(conn)
	require.NoError(t, err)
	return conn, svc
}

func TestBucketName(t *testing.T) {
	t.Parallel()
	conn, svc := openRelationService(t)
	require.Equal(t, BucketName, svc.BucketName())

	require.NoError(t, conn.ViewTx(func(tx portainer.Transaction) error {
		require.Equal(t, BucketName, svc.Tx(tx).BucketName())
		return nil
	}))
}

func TestEndpointRelation_ReadCreateRoundTrip(t *testing.T) {
	t.Parallel()
	_, svc := openRelationService(t)

	_, err := svc.EndpointRelation(99)
	require.Error(t, err)

	rel := &portainer.EndpointRelation{
		EndpointID: 7,
		EdgeStacks: map[portainer.EdgeStackID]bool{},
	}
	require.NoError(t, svc.Create(rel))

	got, err := svc.EndpointRelation(7)
	require.NoError(t, err)
	require.Equal(t, portainer.EndpointID(7), got.EndpointID)
	require.Empty(t, got.EdgeStacks)

	rels, err := svc.EndpointRelations()
	require.NoError(t, err)
	require.Len(t, rels, 1)
}

func TestServiceTx_CreateAndList(t *testing.T) {
	t.Parallel()
	conn, svc := openRelationService(t)

	require.NoError(t, conn.UpdateTx(func(tx portainer.Transaction) error {
		stx := svc.Tx(tx)
		require.NoError(t, stx.Create(&portainer.EndpointRelation{
			EndpointID: 3,
			EdgeStacks: map[portainer.EdgeStackID]bool{},
		}))
		rels, err := stx.EndpointRelations()
		require.NoError(t, err)
		require.Len(t, rels, 1)
		got, err := stx.EndpointRelation(3)
		require.NoError(t, err)
		require.Equal(t, portainer.EndpointID(3), got.EndpointID)
		return nil
	}))

	got, err := svc.EndpointRelation(3)
	require.NoError(t, err)
	require.Equal(t, portainer.EndpointID(3), got.EndpointID)
}

func TestRemoveEndpointRelationsForEdgeStack(t *testing.T) {
	t.Parallel()
	conn, svc := openRelationService(t)

	edgeStackService, err := edgestack.NewService(conn, func(t portainer.Transaction, esi portainer.EdgeStackID) {})
	require.NoError(t, err)
	svc.RegisterUpdateStackFunction(edgeStackService.UpdateEdgeStackFuncTx)

	require.NoError(t, edgeStackService.Create(5, &portainer.EdgeStack{ID: 5}))
	require.NoError(t, svc.Create(&portainer.EndpointRelation{
		EndpointID: 2,
		EdgeStacks: map[portainer.EdgeStackID]bool{5: true},
	}))

	require.NoError(t, svc.RemoveEndpointRelationsForEdgeStack([]portainer.EndpointID{2}, 5))

	got, err := svc.EndpointRelation(2)
	require.NoError(t, err)
	_, stillPresent := got.EdgeStacks[5]
	require.False(t, stillPresent)
}

func TestInvalidateEdgeCacheForEdgeStack(t *testing.T) {
	t.Parallel()
	conn, svc := openRelationService(t)

	require.NoError(t, svc.Create(&portainer.EndpointRelation{
		EndpointID: 11,
		EdgeStacks: map[portainer.EdgeStackID]bool{9: true},
	}))
	require.NoError(t, svc.Create(&portainer.EndpointRelation{
		EndpointID: 12,
		EdgeStacks: map[portainer.EdgeStackID]bool{},
	}))

	cache.Set(11, []byte("cached-11"))
	cache.Set(12, []byte("cached-12"))

	require.NoError(t, conn.ViewTx(func(tx portainer.Transaction) error {
		svc.Tx(tx).InvalidateEdgeCacheForEdgeStack(9)
		return nil
	}))

	_, ok11 := cache.Get(11)
	_, ok12 := cache.Get(12)
	require.False(t, ok11)
	require.True(t, ok12)
}

func TestCachedEndpointRelations_ReusesCache(t *testing.T) {
	t.Parallel()
	conn, svc := openRelationService(t)

	require.NoError(t, svc.Create(&portainer.EndpointRelation{EndpointID: 21, EdgeStacks: map[portainer.EdgeStackID]bool{}}))

	require.NoError(t, conn.ViewTx(func(tx portainer.Transaction) error {
		stx := svc.Tx(tx)
		first, err := stx.cachedEndpointRelations()
		require.NoError(t, err)
		require.Len(t, first, 1)

		second, err := stx.cachedEndpointRelations()
		require.NoError(t, err)
		require.Equal(t, first, second)
		return nil
	}))
}

func TestUpdateEndpointRelation_UpdateStackFnErrorIsLogged(t *testing.T) {
	t.Parallel()
	_, svc := openRelationService(t)

	svc.RegisterUpdateStackFunction(func(tx portainer.Transaction, ID portainer.EdgeStackID, updateFunc func(edgeStack *portainer.EdgeStack)) error {
		return assert.AnError
	})

	require.NoError(t, svc.Create(&portainer.EndpointRelation{
		EndpointID: 31,
		EdgeStacks: map[portainer.EdgeStackID]bool{},
	}))
	require.NoError(t, svc.UpdateEndpointRelation(31, &portainer.EndpointRelation{
		EndpointID: 31,
		EdgeStacks: map[portainer.EdgeStackID]bool{1: true},
	}))
}
