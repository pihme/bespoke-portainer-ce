package tags

import (
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_14_TagList(t *testing.T) {
	t.Parallel()

	t.Run("lists created tags", func(t *testing.T) {
		t.Parallel()
		handler, store := setUpHandler(t)
		require.NoError(t, store.Tag().Create(&portainer.Tag{
			Name:           "alpha",
			Endpoints:      map[portainer.EndpointID]bool{},
			EndpointGroups: map[portainer.EndpointGroupID]bool{},
		}))
		require.NoError(t, store.Tag().Create(&portainer.Tag{
			Name:           "beta",
			Endpoints:      map[portainer.EndpointID]bool{},
			EndpointGroups: map[portainer.EndpointGroupID]bool{},
		}))

		req := httptest.NewRequest(http.MethodGet, "/tags", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		var listed []portainer.Tag
		require.NoError(t, json.NewDecoder(w.Body).Decode(&listed))
		require.Len(t, listed, 2)

		names := map[string]bool{}
		for _, tag := range listed {
			names[tag.Name] = true
			assert.NotZero(t, tag.ID)
		}
		assert.True(t, names["alpha"])
		assert.True(t, names["beta"])
	})

	t.Run("returns empty list when no tags exist", func(t *testing.T) {
		t.Parallel()
		handler, _ := setUpHandler(t)

		req := httptest.NewRequest(http.MethodGet, "/tags", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		var listed []portainer.Tag
		require.NoError(t, json.NewDecoder(w.Body).Decode(&listed))
		assert.Empty(t, listed)
	})
}
