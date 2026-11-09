package sources

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	gittypes "github.com/portainer/portainer/api/git/types"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRedactWorkflowCredentials(t *testing.T) {
	t.Parallel()

	t.Run("clears password and preserves username", func(t *testing.T) {
		t.Parallel()
		wfs := []Workflow{{GitConfig: &gittypes.RepoConfig{
			Authentication: &gittypes.GitAuthentication{Username: "user", Password: "s3cr3t"},
		}}}
		got := RedactWorkflowCredentials(wfs)
		require.NotNil(t, got[0].GitConfig.Authentication)
		assert.Equal(t, "user", got[0].GitConfig.Authentication.Username)
		assert.Empty(t, got[0].GitConfig.Authentication.Password)
	})

	t.Run("does not mutate the original slice", func(t *testing.T) {
		t.Parallel()
		wfs := []Workflow{{GitConfig: &gittypes.RepoConfig{
			Authentication: &gittypes.GitAuthentication{Password: "s3cr3t"},
		}}}
		_ = RedactWorkflowCredentials(wfs)
		assert.Equal(t, "s3cr3t", wfs[0].GitConfig.Authentication.Password)
	})

	t.Run("nil GitConfig is safe", func(t *testing.T) {
		t.Parallel()
		assert.NotPanics(t, func() { RedactWorkflowCredentials([]Workflow{{}}) })
	})

	t.Run("nil Authentication is safe", func(t *testing.T) {
		t.Parallel()
		wfs := []Workflow{{GitConfig: &gittypes.RepoConfig{}}}
		assert.NotPanics(t, func() { RedactWorkflowCredentials(wfs) })
	})
}

func TestBuildConnectionInfo(t *testing.T) {
	t.Parallel()

	assert.Equal(t, connectionInfo{}, buildConnectionInfo(nil))

	cfg := &gittypes.GitSource{
		TLSSkipVerify:  true,
		Authentication: &gittypes.GitAuthentication{Username: "user"},
	}
	got := buildConnectionInfo(cfg)
	assert.True(t, got.TLSSkipVerify)
	require.NotNil(t, got.Authentication)
	assert.Equal(t, "user", got.Authentication.Username)

	got = buildConnectionInfo(&gittypes.GitSource{})
	assert.Nil(t, got.Authentication)
}

func TestREQ_DED_01_ValidateInterval(t *testing.T) {
	t.Parallel()

	require.NoError(t, validateInterval(""))
	require.NoError(t, validateInterval("1m"))
	require.NoError(t, validateInterval("5m"))
	require.NoError(t, validateInterval("1h"))

	err := validateInterval("30s")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "at least 1 minute")

	err = validateInterval("not-a-duration")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid interval format")

	err = validateInterval("0s")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "at least 1 minute")
}

func TestREQ_GIT_02_BuildSourceAccess(t *testing.T) {
	t.Parallel()

	assert.Equal(t, SourceAccess{}, BuildSourceAccess(nil))
	assert.Equal(t, SourceAccess{}, BuildSourceAccess(&portainer.Source{AdministratorsOnly: true}))
	assert.Equal(t, SourceAccess{Public: true}, BuildSourceAccess(&portainer.Source{Public: true}))
	assert.Equal(t, SourceAccess{
		Users: []portainer.UserID{1, 2},
		Teams: []portainer.TeamID{3},
	}, BuildSourceAccess(&portainer.Source{
		UserAccesses: []portainer.UserID{1, 2},
		TeamAccesses: []portainer.TeamID{3},
	}))
}

func TestREQ_GIT_02_ParseSourceTypeAndString(t *testing.T) {
	t.Parallel()

	got, err := parseSourceType("git")
	require.NoError(t, err)
	assert.Equal(t, SourceTypeGit, got)

	_, err = parseSourceType("bogus")
	require.Error(t, err)

	assert.Equal(t, SourceTypeGit, sourceTypeString(portainer.SourceTypeGit))
	assert.Equal(t, SourceTypeGit, sourceTypeString(portainer.SourceType(99)))
}

func TestREQ_GIT_02_SourceTypeString_RegistryAndUnknown(t *testing.T) {
	t.Parallel()
	// Registry maps to the OCI list label; unknown falls back to git for local listings.
	assert.Equal(t, SourceTypeOCI, sourceTypeString(portainer.SourceTypeRegistry))
	assert.Equal(t, SourceTypeGit, sourceTypeString(portainer.SourceType(0)))
}

func TestREQ_GIT_02_ParseSourceType_ValidVariants(t *testing.T) {
	t.Parallel()
	for _, tt := range []SourceType{SourceTypeGit, SourceTypeHelm, SourceTypeOCI} {
		got, err := parseSourceType(string(tt))
		require.NoError(t, err)
		assert.Equal(t, tt, got)
	}
}
