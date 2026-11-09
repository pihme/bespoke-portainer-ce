package sources

import (
	"errors"
	"net/http"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/source"
	"github.com/portainer/portainer/api/datastore"

	"github.com/stretchr/testify/require"
)

func TestValidateGitSourceAccess_NonGit(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)

	nonGit := &portainer.Source{Type: portainer.SourceTypeHelm, Name: "helm-src"}
	require.NoError(t, store.Source().Create(adminUserContext, nonGit))
	_, httpErr := ValidateGitSourceAccess(store, adminUserContext, nonGit.ID)
	require.NotNil(t, httpErr)
	require.Equal(t, http.StatusBadRequest, httpErr.StatusCode)
}

type readErrStore struct {
	dataservices.DataStore
	err error
}

func (s readErrStore) Source() dataservices.SourceService {
	return readErrSource{SourceService: s.DataStore.Source(), err: s.err}
}

func (s readErrStore) IsErrObjectNotFound(err error) bool { return false }

type readErrSource struct {
	dataservices.SourceService
	err error
}

func (s readErrSource) Read(ctx source.UserContext, id portainer.SourceID) (*portainer.Source, error) {
	return nil, s.err
}

func TestValidateGitSourceAccess_ReadError(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	wantErr := errors.New("db boom")
	_, httpErr := ValidateGitSourceAccess(readErrStore{DataStore: store, err: wantErr}, adminUserContext, 1)
	require.NotNil(t, httpErr)
	require.Equal(t, http.StatusInternalServerError, httpErr.StatusCode)
}

func TestResolveRepoConfig_SourceAccessError(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	_, httpErr := ResolveRepoConfig(store, adminUserContext, RepoConfigInput{SourceID: 999})
	require.NotNil(t, httpErr)
	require.Equal(t, http.StatusNotFound, httpErr.StatusCode)
}

func TestValidateGitSourceAccess_NilGitViaStub(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, false, false)
	stub := stubGitNilStore{DataStore: store, src: &portainer.Source{
		ID:   7,
		Type: portainer.SourceTypeGit,
		Git:  nil,
	}}
	_, httpErr := ValidateGitSourceAccess(stub, adminUserContext, 7)
	require.NotNil(t, httpErr)
	require.Equal(t, http.StatusBadRequest, httpErr.StatusCode)
	require.Contains(t, httpErr.Message, "no git configuration")
}

type stubGitNilStore struct {
	dataservices.DataStore
	src *portainer.Source
}

func (s stubGitNilStore) Source() dataservices.SourceService {
	return stubGitNilSource{SourceService: s.DataStore.Source(), src: s.src}
}

func (s stubGitNilStore) IsErrObjectNotFound(err error) bool {
	return s.DataStore.IsErrObjectNotFound(err)
}

type stubGitNilSource struct {
	dataservices.SourceService
	src *portainer.Source
}

func (s stubGitNilSource) Read(ctx source.UserContext, id portainer.SourceID) (*portainer.Source, error) {
	return s.src, nil
}
