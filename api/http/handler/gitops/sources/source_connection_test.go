package sources

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/datastore"
	gittypes "github.com/portainer/portainer/api/git/types"
	"github.com/portainer/portainer/api/http/security"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestREQ_GIT_02_GitSourceTest_Success(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandlerWithGit(t, store, &stubGitService{refs: []string{"refs/heads/main"}})
	body, err := json.Marshal(GitSourceCreatePayload{
		URL:  "https://github.com/org/compose-stack.git",
		Name: "compose-stack",
	})
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildGitSourceTestReq(t, 1, body))
	require.Equal(t, http.StatusOK, rr.Code)

	var result ConnectionTestResult
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&result))
	assert.True(t, result.Success)
	assert.Empty(t, result.Error)
}

func TestREQ_GIT_02_GitSourceTest_FailureReportsError(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandlerWithGit(t, store, &stubGitService{listRefsErr: errors.New("authentication failed")})
	body, err := json.Marshal(GitSourceCreatePayload{
		URL: "https://github.com/org/private-compose.git",
		Authentication: &GitAuthenticationPayload{
			Username: "alice",
			Password: "bad",
		},
	})
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildGitSourceTestReq(t, 1, body))
	require.Equal(t, http.StatusOK, rr.Code)

	var result ConnectionTestResult
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&result))
	assert.False(t, result.Success)
	assert.Contains(t, result.Error, "authentication failed")
}

func TestREQ_GIT_02_GitSourceTest_InvalidPayload(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandlerWithGit(t, store, &stubGitService{})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildGitSourceTestReq(t, 1, []byte(`{"url":""}`)))
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestREQ_GIT_02_SourceTestConnection_UsesStoredSource(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	var srcID portainer.SourceID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		src := &portainer.Source{
			Name: "stored-compose",
			Type: portainer.SourceTypeGit,
			Git: &gittypes.GitSource{
				URL: "https://github.com/org/stored-compose.git",
				Authentication: &gittypes.GitAuthentication{
					Username: "alice",
					Password: "secret",
				},
			},
		}
		require.NoError(t, tx.Source().Create(adminUserContext, src))
		srcID = src.ID
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandlerWithGit(t, store, &stubGitService{})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildSourceTestReq(t, 1, int(srcID), nil))
	require.Equal(t, http.StatusOK, rr.Code)

	var result ConnectionTestResult
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&result))
	assert.True(t, result.Success)
}

func TestREQ_GIT_02_SourceTestConnection_AppliesOverrides(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	var srcID portainer.SourceID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		src := &portainer.Source{
			Name: "override-compose",
			Type: portainer.SourceTypeGit,
			Git:  &gittypes.GitSource{URL: "https://github.com/org/old-compose.git"},
		}
		require.NoError(t, tx.Source().Create(adminUserContext, src))
		srcID = src.ID
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandlerWithGit(t, store, &stubGitService{listRefsErr: errors.New("repo unreachable")})
	body, err := json.Marshal(GitSourceUpdatePayload{
		URL: new("https://github.com/org/new-compose.git"),
	})
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildSourceTestReq(t, 1, int(srcID), body))
	require.Equal(t, http.StatusOK, rr.Code)

	var result ConnectionTestResult
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&result))
	assert.False(t, result.Success)
	assert.Contains(t, result.Error, "repo unreachable")
}

func TestREQ_GIT_02_SourceTestConnection_NotFound(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandlerWithGit(t, store, &stubGitService{})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildSourceTestReq(t, 1, 999, nil))
	require.Equal(t, http.StatusNotFound, rr.Code)
}

func TestREQ_GIT_02_SourceTestConnection_NonNumericID(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandlerWithGit(t, store, &stubGitService{})
	req := httptest.NewRequest(http.MethodPost, "/gitops/sources/abc/test", nil)
	req = withSecurityContext(req, 1)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestREQ_GIT_02_SourceTestConnection_Forbidden(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	var srcID portainer.SourceID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		src := &portainer.Source{
			Name:               "admin-only-compose",
			Type:               portainer.SourceTypeGit,
			Git:                &gittypes.GitSource{URL: "https://github.com/org/admin-compose.git"},
			AdministratorsOnly: true,
		}
		require.NoError(t, tx.Source().Create(adminUserContext, src))
		srcID = src.ID
		require.NoError(t, tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole}))
		return tx.User().Create(&portainer.User{ID: 2, Role: portainer.StandardUserRole})
	}))

	h := newTestHandlerWithGit(t, store, &stubGitService{})
	req := httptest.NewRequest(http.MethodPost, "/gitops/sources/"+strconv.Itoa(int(srcID))+"/test", nil)
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{ID: 2}))
	req = req.WithContext(security.StoreRestrictedRequestContext(req, &security.RestrictedRequestContext{
		UserID: 2,
		User:   &portainer.User{ID: 2, Role: portainer.StandardUserRole},
	}))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	require.Equal(t, http.StatusForbidden, rr.Code)
}

func TestREQ_GIT_02_SourceTestConnection_RejectsNonGitSource(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	var srcID portainer.SourceID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		// Non-git type exercises the git-only guard on the local connection test path.
		src := &portainer.Source{Name: "registry-src", Type: portainer.SourceTypeRegistry}
		require.NoError(t, tx.Source().Create(adminUserContext, src))
		srcID = src.ID
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandlerWithGit(t, store, &stubGitService{})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildSourceTestReq(t, 1, int(srcID), nil))
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestREQ_GIT_02_SourceTestConnection_InvalidOverridePayload(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	var srcID portainer.SourceID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		src := &portainer.Source{
			Name: "compose-src",
			Type: portainer.SourceTypeGit,
			Git:  &gittypes.GitSource{URL: "https://github.com/org/compose.git"},
		}
		require.NoError(t, tx.Source().Create(adminUserContext, src))
		srcID = src.ID
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandlerWithGit(t, store, &stubGitService{})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildSourceTestReq(t, 1, int(srcID), []byte(`{"url":}`)))
	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestREQ_GIT_02_TestAndSaveSourceConnection_PersistsHealthy(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	var srcID portainer.SourceID
	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		src := &portainer.Source{
			Name:   "persist-healthy",
			Type:   portainer.SourceTypeGit,
			Git:    &gittypes.GitSource{URL: "https://github.com/org/persist.git"},
			Status: portainer.SourceStatusUnknown,
		}
		require.NoError(t, tx.Source().Create(adminUserContext, src))
		srcID = src.ID
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandlerWithGit(t, store, &stubGitService{})
	body, err := json.Marshal(GitSourceCreatePayload{
		URL:  "https://github.com/org/new-persist.git",
		Name: "created-with-check",
	})
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildCreateReq(t, 1, body))
	require.Equal(t, http.StatusCreated, rr.Code)

	var created portainer.Source
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&created))
	require.NotZero(t, created.ID)
	assert.Equal(t, portainer.SourceStatusHealthy, created.Status)

	// Existing source updated through git update also persists connection status.
	updateBody, err := json.Marshal(GitSourceUpdatePayload{Name: new("renamed")})
	require.NoError(t, err)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, buildUpdateReq(t, 1, int(srcID), updateBody))
	require.Equal(t, http.StatusOK, rr.Code)

	var updated portainer.Source
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&updated))
	assert.Equal(t, portainer.SourceStatusHealthy, updated.Status)
}

func TestREQ_GIT_02_TestAndSaveSourceConnection_PersistsError(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, true)

	require.NoError(t, store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.User().Create(&portainer.User{ID: 1, Role: portainer.AdministratorRole})
	}))

	h := newTestHandlerWithGit(t, store, &stubGitService{listRefsErr: errors.New("dns lookup failed")})
	body, err := json.Marshal(GitSourceCreatePayload{
		URL:  "https://github.com/org/failing-compose.git",
		Name: "failing-compose",
	})
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, buildCreateReq(t, 1, body))
	require.Equal(t, http.StatusCreated, rr.Code)

	var created portainer.Source
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&created))
	assert.Equal(t, portainer.SourceStatusError, created.Status)
	assert.Contains(t, created.StatusError, "dns lookup failed")
}

func TestREQ_GIT_02_TestSourceConnection_Unit(t *testing.T) {
	t.Parallel()

	ok := testSourceConnection(t.Context(), &stubGitService{}, &gittypes.GitSource{URL: "https://example.com/repo.git"})
	assert.True(t, ok.Success)

	withAuth := testSourceConnection(t.Context(), &stubGitService{}, &gittypes.GitSource{
		URL:            "https://example.com/repo.git",
		Authentication: &gittypes.GitAuthentication{Username: "u", Password: "p"},
	})
	assert.True(t, withAuth.Success)

	fail := testSourceConnection(t.Context(), &stubGitService{listRefsErr: errors.New("boom")}, &gittypes.GitSource{URL: "https://example.com/repo.git"})
	assert.False(t, fail.Success)
	assert.Equal(t, "boom", fail.Error)
}
