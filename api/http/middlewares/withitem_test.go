package middlewares

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	dserrors "github.com/portainer/portainer/api/dataservices/errors"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"
)

type sampleItem struct {
	ID   int
	Name string
}

const sampleItemKey ItemContextKey = "sample-item"

func TestWithItem_DefaultsParamAndLoadsItem(t *testing.T) {
	t.Parallel()

	item := &sampleItem{ID: 5, Name: "alpha"}
	getter := func(id int) (*sampleItem, error) {
		require.Equal(t, 5, id)
		return item, nil
	}

	var got *sampleItem
	handler := WithItem(getter, "", sampleItemKey)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var err error
		got, err = FetchItem[sampleItem](r, sampleItemKey)
		require.NoError(t, err)
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/items/5", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "5"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, item, got)
}

func TestWithItem_CustomParamName(t *testing.T) {
	t.Parallel()

	getter := func(id int) (*sampleItem, error) {
		return &sampleItem{ID: id, Name: "custom"}, nil
	}

	var gotName string
	handler := WithItem(getter, "itemId", sampleItemKey)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		item, err := FetchItem[sampleItem](r, sampleItemKey)
		require.NoError(t, err)
		gotName = item.Name
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/things/9", nil)
	req = mux.SetURLVars(req, map[string]string{"itemId": "9"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "custom", gotName)
}

func TestWithItem_InvalidRouteVariable(t *testing.T) {
	t.Parallel()

	called := false
	handler := WithItem(func(int) (*sampleItem, error) {
		t.Fatal("getter must not run")
		return nil, nil
	}, "id", sampleItemKey)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		called = true
	}))

	req := httptest.NewRequest(http.MethodGet, "/items/nope", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "nope"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.False(t, called)
}

func TestWithItem_NotFound(t *testing.T) {
	t.Parallel()

	handler := WithItem(func(int) (*sampleItem, error) {
		return nil, dserrors.ErrObjectNotFound
	}, "id", sampleItemKey)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("next must not run")
	}))

	req := httptest.NewRequest(http.MethodGet, "/items/1", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNotFound, rec.Code)
}

func TestWithItem_LookupError(t *testing.T) {
	t.Parallel()

	handler := WithItem(func(int) (*sampleItem, error) {
		return nil, errors.New("db unavailable")
	}, "id", sampleItemKey)(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("next must not run")
	}))

	req := httptest.NewRequest(http.MethodGet, "/items/1", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusInternalServerError, rec.Code)
}

func TestFetchItem_MissingFromContext(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	item, err := FetchItem[sampleItem](req, sampleItemKey)

	require.Nil(t, item)
	require.Error(t, err)
	require.Contains(t, err.Error(), "unable to find item in request context")
}

func TestFetchItem_WrongType(t *testing.T) {
	t.Parallel()

	// Store a different type under the key, then ask for sampleItem.
	handler := WithItem(func(int) (*int, error) {
		v := 42
		return &v, nil
	}, "id", sampleItemKey)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		item, err := FetchItem[sampleItem](r, sampleItemKey)
		require.Nil(t, item)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unable to cast context item")
		w.WriteHeader(http.StatusTeapot)
	}))

	req := httptest.NewRequest(http.MethodGet, "/items/1", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusTeapot, rec.Code)
}
