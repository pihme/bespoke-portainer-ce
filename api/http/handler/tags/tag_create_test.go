package tags

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_ENV_14_TagCreatePayload_Validate(t *testing.T) {
	t.Parallel()

	t.Run("accepts non-empty name", func(t *testing.T) {
		t.Parallel()
		payload := &tagCreatePayload{Name: "org/acme"}
		require.NoError(t, payload.Validate(nil))
	})

	t.Run("rejects empty name", func(t *testing.T) {
		t.Parallel()
		payload := &tagCreatePayload{Name: ""}
		require.EqualError(t, payload.Validate(nil), "invalid tag name")
	})
}

func TestREQ_ENV_14_TagCreate(t *testing.T) {
	t.Parallel()

	t.Run("creates tag for local environment labeling", func(t *testing.T) {
		t.Parallel()
		handler, store := setUpHandler(t)

		body, err := json.Marshal(tagCreatePayload{Name: "local-docker"})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/tags", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)

		var created portainer.Tag
		require.NoError(t, json.NewDecoder(w.Body).Decode(&created))
		assert.Equal(t, "local-docker", created.Name)
		assert.NotZero(t, created.ID)
		assert.Empty(t, created.Endpoints)
		assert.Empty(t, created.EndpointGroups)

		saved, err := store.Tag().Read(created.ID)
		require.NoError(t, err)
		assert.Equal(t, "local-docker", saved.Name)
		assert.NotNil(t, saved.Endpoints)
		assert.NotNil(t, saved.EndpointGroups)
		assert.Empty(t, saved.Endpoints)
		assert.Empty(t, saved.EndpointGroups)
	})

	t.Run("rejects duplicate tag name", func(t *testing.T) {
		t.Parallel()
		handler, store := setUpHandler(t)
		require.NoError(t, store.Tag().Create(&portainer.Tag{
			Name:           "dup-name",
			Endpoints:      map[portainer.EndpointID]bool{},
			EndpointGroups: map[portainer.EndpointGroupID]bool{},
		}))

		body, err := json.Marshal(tagCreatePayload{Name: "dup-name"})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/tags", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusConflict, w.Code)
	})

	t.Run("rejects empty name via HTTP", func(t *testing.T) {
		t.Parallel()
		handler, _ := setUpHandler(t)

		body, err := json.Marshal(tagCreatePayload{Name: ""})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/tags", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("rejects invalid JSON payload", func(t *testing.T) {
		t.Parallel()
		handler, _ := setUpHandler(t)

		req := httptest.NewRequest(http.MethodPost, "/tags", bytes.NewReader([]byte(`{`)))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}
