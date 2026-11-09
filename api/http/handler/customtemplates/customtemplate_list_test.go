package customtemplates

import (
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	gittypes "github.com/portainer/portainer/api/git/types"
	"github.com/portainer/portainer/api/http/security"

	"github.com/segmentio/encoding/json"
	"github.com/stretchr/testify/require"
)

func TestCustomTemplateList_PopulatesGitConfigFromSource(t *testing.T) {
	t.Parallel()

	handler, ds, _ := newTestHandler(t)

	var srcID portainer.SourceID
	require.NoError(t, ds.UpdateTx(func(tx dataservices.DataStoreTx) error {
		src := &portainer.Source{
			Type: portainer.SourceTypeGit,
			Git: &gittypes.GitSource{
				URL:           "https://github.com/example/repo",
				TLSSkipVerify: true,
			},
		}
		err := tx.Source().Create(adminUserContext, src)
		require.NoError(t, err)
		srcID = src.ID
		require.NoError(t, tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID: 1,
			Artifact: &portainer.Artifact{
				Files: []portainer.ArtifactFile{{
					Ref:      "refs/heads/main",
					Path:     "docker-compose.yml",
					Hash:     "abc123",
					SourceID: srcID,
				}},
			},
		}))
		require.NoError(t, tx.CustomTemplate().Create(&portainer.CustomTemplate{ID: 2, EntryPoint: "docker-compose.yml"}))

		return nil
	}))

	r := httptest.NewRequest(http.MethodGet, "/custom_templates", nil)
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{UserID: 1, IsAdmin: true, User: &portainer.User{ID: 1, Role: portainer.AdministratorRole}}))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, r)

	require.Equal(t, http.StatusOK, rr.Code)

	var templates []portainer.CustomTemplate
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&templates))

	var gitTemplate portainer.CustomTemplate
	for _, tpl := range templates {
		if tpl.ID == 1 {
			gitTemplate = tpl
		}
	}

	require.NotNil(t, gitTemplate.GitConfig)
	require.Equal(t, "https://github.com/example/repo", gitTemplate.GitConfig.URL)
	require.True(t, gitTemplate.GitConfig.TLSSkipVerify)
	require.Equal(t, "refs/heads/main", gitTemplate.GitConfig.ReferenceName)
	require.Equal(t, "docker-compose.yml", gitTemplate.GitConfig.ConfigFilePath)
	require.Equal(t, "abc123", gitTemplate.GitConfig.ConfigHash)

	var plainTemplate portainer.CustomTemplate
	for _, tpl := range templates {
		if tpl.ID == 2 {
			plainTemplate = tpl
		}
	}
	require.Nil(t, plainTemplate.GitConfig)
}

func TestCustomTemplateList_StripsPasswordFromGitConfig(t *testing.T) {
	t.Parallel()

	handler, ds, _ := newTestHandler(t)

	var srcID portainer.SourceID
	require.NoError(t, ds.UpdateTx(func(tx dataservices.DataStoreTx) error {
		src := &portainer.Source{
			Type: portainer.SourceTypeGit,
			Git: &gittypes.GitSource{
				URL: "https://github.com/example/repo",
				Authentication: &gittypes.GitAuthentication{
					Username: "user",
					Password: "topsecret",
				},
			},
		}
		err := tx.Source().Create(adminUserContext, src)
		require.NoError(t, err)
		srcID = src.ID
		require.NoError(t, tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID: 1,
			Artifact: &portainer.Artifact{
				Files: []portainer.ArtifactFile{{SourceID: srcID}},
			},
		}))

		return nil
	}))

	r := httptest.NewRequest(http.MethodGet, "/custom_templates", nil)
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{UserID: 1, IsAdmin: true, User: &portainer.User{ID: 1, Role: portainer.AdministratorRole}}))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, r)

	require.Equal(t, http.StatusOK, rr.Code)

	var templates []portainer.CustomTemplate
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&templates))
	require.Len(t, templates, 1)
	require.NotNil(t, templates[0].GitConfig)
	require.NotNil(t, templates[0].GitConfig.Authentication)
	require.Equal(t, "user", templates[0].GitConfig.Authentication.Username)
	require.Empty(t, templates[0].GitConfig.Authentication.Password)
}

func TestREQ_TPL_03_CustomTemplateList_FiltersLocalComposeByType(t *testing.T) {
	t.Parallel()

	handler, ds, _ := newTestHandler(t)

	require.NoError(t, ds.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID: 1, Title: "compose-app", Type: portainer.DockerComposeStack, CreatedByUserID: 1,
		}))
		require.NoError(t, tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID: 2, Title: "swarm-app", Type: portainer.DockerSwarmStack, CreatedByUserID: 1,
		}))
		require.NoError(t, tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID: 3, Title: "kube-app", Type: portainer.KubernetesStack, CreatedByUserID: 1,
		}))
		return nil
	}))

	r := httptest.NewRequest(http.MethodGet, "/custom_templates?type=2", nil)
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{
		UserID: 1, IsAdmin: true, User: &portainer.User{ID: 1, Role: portainer.AdministratorRole},
	}))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, r)

	require.Equal(t, http.StatusOK, rr.Code)

	var templates []portainer.CustomTemplate
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&templates))
	require.Len(t, templates, 1)
	require.Equal(t, portainer.CustomTemplateID(1), templates[0].ID)
	require.Equal(t, portainer.DockerComposeStack, templates[0].Type)
}

func TestREQ_TPL_03_CustomTemplateList_InvalidTypeReturnsBadRequest(t *testing.T) {
	t.Parallel()

	handler, _, _ := newTestHandler(t)

	r := httptest.NewRequest(http.MethodGet, "/custom_templates?type=not-a-number", nil)
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{
		UserID: 1, IsAdmin: true, User: &portainer.User{ID: 1, Role: portainer.AdministratorRole},
	}))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, r)

	require.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestREQ_TPL_03_CustomTemplateList_NonAdminSeesAuthorizedComposeOnly(t *testing.T) {
	t.Parallel()

	handler, ds, _ := newTestHandler(t)

	require.NoError(t, ds.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID: 1, Title: "mine", Type: portainer.DockerComposeStack, CreatedByUserID: 2,
		}))
		require.NoError(t, tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID: 2, Title: "public", Type: portainer.DockerComposeStack, CreatedByUserID: 1,
		}))
		require.NoError(t, tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID: 3, Title: "other-private", Type: portainer.DockerComposeStack, CreatedByUserID: 1,
		}))
		require.NoError(t, tx.ResourceControl().Create(&portainer.ResourceControl{
			ID: 1, ResourceID: "1", Type: portainer.CustomTemplateResourceControl,
			UserAccesses: []portainer.UserResourceAccess{{UserID: 2}},
		}))
		require.NoError(t, tx.ResourceControl().Create(&portainer.ResourceControl{
			ID: 2, ResourceID: "2", Type: portainer.CustomTemplateResourceControl, Public: true,
		}))
		require.NoError(t, tx.ResourceControl().Create(&portainer.ResourceControl{
			ID: 3, ResourceID: "3", Type: portainer.CustomTemplateResourceControl,
			UserAccesses: []portainer.UserResourceAccess{{UserID: 1}},
		}))
		return nil
	}))

	r := httptest.NewRequest(http.MethodGet, "/custom_templates?type=2", nil)
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{
		UserID: 2, IsAdmin: false, User: &portainer.User{ID: 2, Role: portainer.StandardUserRole},
	}))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, r)

	require.Equal(t, http.StatusOK, rr.Code)

	var templates []portainer.CustomTemplate
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&templates))
	require.Len(t, templates, 2)
	ids := map[portainer.CustomTemplateID]bool{}
	for _, tmpl := range templates {
		ids[tmpl.ID] = true
	}
	require.True(t, ids[1])
	require.True(t, ids[2])
	require.False(t, ids[3])
}

func TestREQ_TPL_03_CustomTemplateList_EdgeFalseKeepsLocalCompose(t *testing.T) {
	t.Parallel()

	handler, ds, _ := newTestHandler(t)

	require.NoError(t, ds.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID: 1, Title: "local", Type: portainer.DockerComposeStack, EdgeTemplate: false, CreatedByUserID: 1,
		}))
		require.NoError(t, tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID: 2, Title: "edge-marked", Type: portainer.DockerComposeStack, EdgeTemplate: true, CreatedByUserID: 1,
		}))
		return nil
	}))

	r := httptest.NewRequest(http.MethodGet, "/custom_templates?type=2&edge=false", nil)
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{
		UserID: 1, IsAdmin: true, User: &portainer.User{ID: 1, Role: portainer.AdministratorRole},
	}))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, r)

	require.Equal(t, http.StatusOK, rr.Code)

	var templates []portainer.CustomTemplate
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&templates))
	require.Len(t, templates, 1)
	require.Equal(t, "local", templates[0].Title)
	require.False(t, templates[0].EdgeTemplate)
}

func TestREQ_TPL_03_CustomTemplateList_InvalidEdgeParamIgnored(t *testing.T) {
	t.Parallel()

	handler, ds, _ := newTestHandler(t)

	require.NoError(t, ds.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID: 1, Title: "compose", Type: portainer.DockerComposeStack, CreatedByUserID: 1,
		})
	}))

	r := httptest.NewRequest(http.MethodGet, "/custom_templates?edge=not-bool", nil)
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{
		UserID: 1, IsAdmin: true, User: &portainer.User{ID: 1, Role: portainer.AdministratorRole},
	}))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, r)

	require.Equal(t, http.StatusOK, rr.Code)

	var templates []portainer.CustomTemplate
	require.NoError(t, json.NewDecoder(rr.Body).Decode(&templates))
	require.Len(t, templates, 1)
}

func TestREQ_TPL_03_CustomTemplateList_MissingSecurityContext(t *testing.T) {
	t.Parallel()

	handler, _, _ := newTestHandler(t)

	r := httptest.NewRequest(http.MethodGet, "/custom_templates", nil)
	rr := httptest.NewRecorder()
	herr := handler.customTemplateList(rr, r)
	require.NotNil(t, herr)
	require.Equal(t, http.StatusInternalServerError, herr.StatusCode)
}

func TestREQ_TPL_03_ParseTemplateTypes_AndFilterByType(t *testing.T) {
	t.Parallel()

	r := httptest.NewRequest(http.MethodGet, "/custom_templates?type=2&type=1", nil)
	types, err := parseTemplateTypes(r)
	require.NoError(t, err)
	require.Equal(t, []portainer.StackType{portainer.DockerComposeStack, portainer.DockerSwarmStack}, types)

	rEmpty := httptest.NewRequest(http.MethodGet, "/custom_templates", nil)
	emptyTypes, err := parseTemplateTypes(rEmpty)
	require.NoError(t, err)
	require.Empty(t, emptyTypes)

	templates := []portainer.CustomTemplate{
		{ID: 1, Type: portainer.DockerComposeStack},
		{ID: 2, Type: portainer.DockerSwarmStack},
		{ID: 3, Type: portainer.KubernetesStack},
	}
	filtered := filterByType(templates, []portainer.StackType{portainer.DockerComposeStack})
	require.Len(t, filtered, 1)
	require.Equal(t, portainer.CustomTemplateID(1), filtered[0].ID)

	unfiltered := filterByType(templates, nil)
	require.Len(t, unfiltered, 3)
}
