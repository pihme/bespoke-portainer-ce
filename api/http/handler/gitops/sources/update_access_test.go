package sources

import (
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/datastore"
	gittypes "github.com/portainer/portainer/api/git/types"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_GIT_02_UpdateAccess_PublicClearsRestrictions(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	var srcID portainer.SourceID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		src := &portainer.Source{
			Name:               "access-source",
			Type:               portainer.SourceTypeGit,
			Git:                &gittypes.GitSource{URL: "https://github.com/org/compose-app.git"},
			AdministratorsOnly: true,
			UserAccesses:       []portainer.UserID{2},
			TeamAccesses:       []portainer.TeamID{3},
		}
		require.NoError(t, tx.Source().Create(adminUserContext, src))
		srcID = src.ID
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandler(t, store)
	body, err := json.Marshal(SourceAccessUpdatePayload{Public: true})
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildUpdateAccessReq(t, 1, int(srcID), body))
	require.Equal(t, http.StatusOK, rr.Code)

	var stored *portainer.Source
	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		var err error
		stored, err = tx.Source().Read(adminUserContext, srcID)
		return err
	}))
	assert.True(t, stored.Public)
	assert.False(t, stored.AdministratorsOnly)
	assert.Empty(t, stored.UserAccesses)
	assert.Empty(t, stored.TeamAccesses)
}

func TestREQ_GIT_02_UpdateAccess_EmptyUsersTeamsSetsAdminsOnly(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	var srcID portainer.SourceID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		src := &portainer.Source{
			Name:   "private-compose",
			Type:   portainer.SourceTypeGit,
			Git:    &gittypes.GitSource{URL: "https://github.com/org/private-compose.git"},
			Public: true,
		}
		require.NoError(t, tx.Source().Create(adminUserContext, src))
		srcID = src.ID
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandler(t, store)
	body, err := json.Marshal(SourceAccessUpdatePayload{Public: false})
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildUpdateAccessReq(t, 1, int(srcID), body))
	require.Equal(t, http.StatusOK, rr.Code)

	var stored *portainer.Source
	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		var err error
		stored, err = tx.Source().Read(adminUserContext, srcID)
		return err
	}))
	assert.False(t, stored.Public)
	assert.True(t, stored.AdministratorsOnly)
	assert.Empty(t, stored.UserAccesses)
	assert.Empty(t, stored.TeamAccesses)
}

func TestREQ_GIT_02_UpdateAccess_AssignsUsersAndTeams(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	var srcID portainer.SourceID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		src := &portainer.Source{
			Name:               "shared-compose",
			Type:               portainer.SourceTypeGit,
			Git:                &gittypes.GitSource{URL: "https://github.com/org/shared-compose.git"},
			AdministratorsOnly: true,
		}
		require.NoError(t, tx.Source().Create(adminUserContext, src))
		srcID = src.ID
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandler(t, store)
	body, err := json.Marshal(SourceAccessUpdatePayload{
		Public: false,
		Users:  []portainer.UserID{2, 3},
		Teams:  []portainer.TeamID{4},
	})
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildUpdateAccessReq(t, 1, int(srcID), body))
	require.Equal(t, http.StatusOK, rr.Code)

	var stored *portainer.Source
	require.NoError(t, store.ViewTx(func(tx dataservices.DataStoreTx) error {
		var err error
		stored, err = tx.Source().Read(adminUserContext, srcID)
		return err
	}))
	assert.False(t, stored.Public)
	assert.False(t, stored.AdministratorsOnly)
	assert.Equal(t, []portainer.UserID{2, 3}, stored.UserAccesses)
	assert.Equal(t, []portainer.TeamID{4}, stored.TeamAccesses)
}

func TestREQ_GIT_02_UpdateAccess_NotFound(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandler(t, store)
	body, err := json.Marshal(SourceAccessUpdatePayload{Public: true})
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildUpdateAccessReq(t, 1, 999, body))
	require.Equal(t, http.StatusNotFound, rr.Code)
}

func TestREQ_GIT_02_UpdateAccess_NonNumericID(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandler(t, store)
	body, err := json.Marshal(SourceAccessUpdatePayload{Public: true})
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildUpdateAccessReqWithRawID(t, 1, "not-a-number", body))
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestREQ_GIT_02_UpdateAccess_MalformedJSON(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	var srcID portainer.SourceID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		src := &portainer.Source{Name: "src", Type: portainer.SourceTypeGit, Git: &gittypes.GitSource{URL: "https://github.com/org/repo.git"}}
		require.NoError(t, tx.Source().Create(adminUserContext, src))
		srcID = src.ID
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandler(t, store)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildUpdateAccessReq(t, 1, int(srcID), []byte("not-json{")))
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestREQ_GIT_02_ApplySourceAccessChanges(t *testing.T) {
	t.Parallel()

	t.Run("public clears accesses", func(t *testing.T) {
		t.Parallel()
		src := &portainer.Source{
			AdministratorsOnly: true,
			UserAccesses:       []portainer.UserID{1},
			TeamAccesses:       []portainer.TeamID{2},
		}
		ApplySourceAccessChanges(src, SourceAccessUpdatePayload{Public: true})
		assert.True(t, src.Public)
		assert.False(t, src.AdministratorsOnly)
		assert.Empty(t, src.UserAccesses)
		assert.Empty(t, src.TeamAccesses)
	})

	t.Run("empty restricted becomes admins only", func(t *testing.T) {
		t.Parallel()
		src := &portainer.Source{Public: true}
		ApplySourceAccessChanges(src, SourceAccessUpdatePayload{})
		assert.False(t, src.Public)
		assert.True(t, src.AdministratorsOnly)
	})

	t.Run("users and teams assigned", func(t *testing.T) {
		t.Parallel()
		src := &portainer.Source{AdministratorsOnly: true}
		ApplySourceAccessChanges(src, SourceAccessUpdatePayload{
			Users: []portainer.UserID{9},
			Teams: []portainer.TeamID{8},
		})
		assert.False(t, src.AdministratorsOnly)
		assert.Equal(t, []portainer.UserID{9}, src.UserAccesses)
		assert.Equal(t, []portainer.TeamID{8}, src.TeamAccesses)
	})
}

func TestREQ_GIT_02_SourceAccessUpdatePayload_Validate(t *testing.T) {
	t.Parallel()
	require.NoError(t, (&SourceAccessUpdatePayload{Public: true}).Validate(nil))
}
