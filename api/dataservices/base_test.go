package dataservices

import (
	"errors"
	"strconv"
	"testing"

	portainer "github.com/portainer/portainer/api"
	dserrors "github.com/portainer/portainer/api/dataservices/errors"
	"github.com/portainer/portainer/api/slicesx"

	"github.com/stretchr/testify/require"
)

type testObject struct {
	ID    int
	Value int
}

type mockConnection struct {
	store     map[int]testObject
	getErr    error
	existsErr error
	deleteErr error
	updateErr error

	portainer.Connection
}

func (m mockConnection) UpdateObject(bucket string, key []byte, value any) error {
	if m.updateErr != nil {
		return m.updateErr
	}
	obj := value.(*testObject)
	m.store[obj.ID] = *obj
	return nil
}

func (m mockConnection) GetObject(bucket string, key []byte, object any) error {
	if m.getErr != nil {
		return m.getErr
	}
	id, err := strconv.Atoi(string(key))
	if err != nil {
		return err
	}
	obj, ok := m.store[id]
	if !ok {
		return dserrors.ErrObjectNotFound
	}
	*(object.(*testObject)) = obj
	return nil
}

func (m mockConnection) KeyExists(bucket string, key []byte) (bool, error) {
	if m.existsErr != nil {
		return false, m.existsErr
	}
	id, err := strconv.Atoi(string(key))
	if err != nil {
		return false, err
	}
	_, ok := m.store[id]
	return ok, nil
}

func (m mockConnection) DeleteObject(bucket string, key []byte) error {
	if m.deleteErr != nil {
		return m.deleteErr
	}
	id, err := strconv.Atoi(string(key))
	if err != nil {
		return err
	}
	delete(m.store, id)
	return nil
}

func (m mockConnection) GetAll(bucketName string, obj any, appendFn func(o any) (any, error)) error {
	for _, v := range m.store {
		copy := v
		if _, err := appendFn(&copy); err != nil {
			return err
		}
	}
	return nil
}

func (m mockConnection) UpdateTx(fn func(portainer.Transaction) error) error {
	return fn(m)
}

func (m mockConnection) ViewTx(fn func(portainer.Transaction) error) error {
	return fn(m)
}

func (m mockConnection) ConvertToKey(v int) []byte {
	return []byte(strconv.Itoa(v))
}

func newService(store map[int]testObject) BaseDataService[testObject, int] {
	if store == nil {
		store = make(map[int]testObject)
	}
	return BaseDataService[testObject, int]{
		Bucket:     "testBucket",
		Connection: mockConnection{store: store},
	}
}

func TestReadAll(t *testing.T) {
	t.Parallel()
	service := newService(nil)

	data := []testObject{
		{ID: 1, Value: 1},
		{ID: 2, Value: 2},
		{ID: 3, Value: 3},
		{ID: 4, Value: 4},
		{ID: 5, Value: 5},
	}

	for _, item := range data {
		err := service.Update(item.ID, &item)
		require.NoError(t, err)
	}

	result, err := service.ReadAll()
	require.NoError(t, err)

	expected := append([]testObject{}, data...)
	require.ElementsMatch(t, expected, result)

	hasLowID := func(obj testObject) bool { return obj.ID < 3 }
	isEven := func(obj testObject) bool { return obj.Value%2 == 0 }

	result, err = service.ReadAll(hasLowID, isEven)
	require.NoError(t, err)

	expected = slicesx.Filter(expected, hasLowID)
	expected = slicesx.Filter(expected, isEven)
	require.ElementsMatch(t, expected, result)
}

func TestBucketName(t *testing.T) {
	t.Parallel()
	service := newService(nil)
	require.Equal(t, "testBucket", service.BucketName())
	require.Equal(t, "testBucket", service.Tx(mockConnection{store: make(map[int]testObject)}).BucketName())
}

func TestRead(t *testing.T) {
	t.Parallel()
	store := map[int]testObject{7: {ID: 7, Value: 70}}
	service := newService(store)

	got, err := service.Read(7)
	require.NoError(t, err)
	require.Equal(t, &testObject{ID: 7, Value: 70}, got)

	_, err = service.Read(99)
	require.ErrorIs(t, err, dserrors.ErrObjectNotFound)

	failing := BaseDataService[testObject, int]{
		Bucket:     "testBucket",
		Connection: mockConnection{store: store, getErr: errors.New("read boom")},
	}
	_, err = failing.Read(7)
	require.EqualError(t, err, "read boom")
}

func TestExists(t *testing.T) {
	t.Parallel()
	store := map[int]testObject{3: {ID: 3, Value: 30}}
	service := newService(store)

	ok, err := service.Exists(3)
	require.NoError(t, err)
	require.True(t, ok)

	ok, err = service.Exists(9)
	require.NoError(t, err)
	require.False(t, ok)

	failing := BaseDataService[testObject, int]{
		Bucket:     "testBucket",
		Connection: mockConnection{store: store, existsErr: errors.New("exists boom")},
	}
	_, err = failing.Exists(3)
	require.EqualError(t, err, "exists boom")
}

func TestDelete(t *testing.T) {
	t.Parallel()
	store := map[int]testObject{5: {ID: 5, Value: 50}}
	service := newService(store)

	require.NoError(t, service.Delete(5))
	_, ok := store[5]
	require.False(t, ok)

	failing := BaseDataService[testObject, int]{
		Bucket:     "testBucket",
		Connection: mockConnection{store: map[int]testObject{1: {ID: 1}}, deleteErr: errors.New("delete boom")},
	}
	require.EqualError(t, failing.Delete(1), "delete boom")
}

func TestReadGeneric(t *testing.T) {
	t.Parallel()
	conn := mockConnection{store: map[int]testObject{2: {ID: 2, Value: 20}}}
	got, err := Read[testObject](conn, "testBucket", conn.ConvertToKey(2))
	require.NoError(t, err)
	require.Equal(t, &testObject{ID: 2, Value: 20}, got)

	_, err = Read[testObject](conn, "testBucket", conn.ConvertToKey(404))
	require.ErrorIs(t, err, dserrors.ErrObjectNotFound)
}

func TestIsErrObjectNotFound(t *testing.T) {
	t.Parallel()
	require.True(t, IsErrObjectNotFound(dserrors.ErrObjectNotFound))
	require.True(t, IsErrObjectNotFound(errors.Join(errors.New("wrap"), dserrors.ErrObjectNotFound)))
	require.False(t, IsErrObjectNotFound(errors.New("other")))
	require.False(t, IsErrObjectNotFound(nil))
}

func TestAppendFnTypeAssertionFailure(t *testing.T) {
	t.Parallel()
	collection := []testObject{}
	fn := AppendFn(&collection)
	_, err := fn("not-a-pointer")
	require.Error(t, err)
	require.Empty(t, collection)
}

func TestFilterFnTypeAssertionFailure(t *testing.T) {
	t.Parallel()
	collection := []testObject{}
	fn := FilterFn(&collection, func(testObject) bool { return true })
	_, err := fn(42)
	require.Error(t, err)
	require.Empty(t, collection)
}

func TestFirstFn(t *testing.T) {
	t.Parallel()
	var found testObject
	fn := FirstFn(&found, func(o testObject) bool { return o.Value == 2 })

	next, err := fn(&testObject{ID: 1, Value: 1})
	require.NoError(t, err)
	require.Equal(t, &testObject{}, next) // zeroed after miss
	require.Equal(t, testObject{}, found)

	next, err = fn(&testObject{ID: 2, Value: 2})
	require.ErrorIs(t, err, ErrStop)
	require.Equal(t, &testObject{ID: 2, Value: 2}, next)
	require.Equal(t, testObject{ID: 2, Value: 2}, found)

	_, err = FirstFn(&found, func(testObject) bool { return true })("bad")
	require.Error(t, err)
}
