package customtemplates

import (
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/http/security"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"
)

func TestCustomTemplateDelete_NotFound(t *testing.T) {
	t.Parallel()

	handler, _, _ := newTestHandler(t)

	r := httptest.NewRequest(http.MethodDelete, "/custom_templates/99", nil)
	r = mux.SetURLVars(r, map[string]string{"id": "99"})
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{UserID: 1, IsAdmin: true}))
	rr := httptest.NewRecorder()

	herr := handler.customTemplateDelete(rr, r)
	require.NotNil(t, herr)
	require.Equal(t, http.StatusNotFound, herr.StatusCode)
}

func TestCustomTemplateDelete_Forbidden(t *testing.T) {
	t.Parallel()

	handler, store, _ := newTestHandler(t)

	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		err := tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID:              1,
			CreatedByUserID: 1,
		})
		require.NoError(t, err)

		return nil
	})
	require.NoError(t, err)

	// User 2 did not create this template and is not an admin
	r := httptest.NewRequest(http.MethodDelete, "/custom_templates/1", nil)
	r = mux.SetURLVars(r, map[string]string{"id": "1"})
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{UserID: 2}))
	rr := httptest.NewRecorder()

	herr := handler.customTemplateDelete(rr, r)
	require.NotNil(t, herr)
	require.Equal(t, http.StatusForbidden, herr.StatusCode)
}

func TestCustomTemplateDelete_CreatorDeniedWhenAdminOnly(t *testing.T) {
	t.Parallel()

	handler, store, _ := newTestHandler(t)

	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		err := tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID:              1,
			CreatedByUserID: 2,
		})
		require.NoError(t, err)

		err = tx.ResourceControl().Create(&portainer.ResourceControl{
			ID:                 1,
			ResourceID:         "1",
			Type:               portainer.CustomTemplateResourceControl,
			AdministratorsOnly: true,
		})
		require.NoError(t, err)

		return nil
	})
	require.NoError(t, err)

	// User 2 created the template but an admin later changed it to admins-only
	r := httptest.NewRequest(http.MethodDelete, "/custom_templates/1", nil)
	r = mux.SetURLVars(r, map[string]string{"id": "1"})
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{UserID: 2}))
	rr := httptest.NewRecorder()

	herr := handler.customTemplateDelete(rr, r)
	require.NotNil(t, herr)
	require.Equal(t, http.StatusForbidden, herr.StatusCode)
}

func TestCustomTemplateDelete_CreatorDeniedWithoutResourceControl(t *testing.T) {
	t.Parallel()

	handler, store, _ := newTestHandler(t)

	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID:              1,
			CreatedByUserID: 2,
		})
	})
	require.NoError(t, err)

	// User 2 created this template but there is no resource control
	r := httptest.NewRequest(http.MethodDelete, "/custom_templates/1", nil)
	r = mux.SetURLVars(r, map[string]string{"id": "1"})
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{UserID: 2}))
	rr := httptest.NewRecorder()

	herr := handler.customTemplateDelete(rr, r)
	require.NotNil(t, herr)
	require.Equal(t, http.StatusForbidden, herr.StatusCode)
}

func TestCustomTemplateDelete_Success(t *testing.T) {
	t.Parallel()

	handler, store, _ := newTestHandler(t)

	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		err := tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID:              1,
			CreatedByUserID: 2,
		})
		require.NoError(t, err)

		err = tx.ResourceControl().Create(&portainer.ResourceControl{
			ID:           1,
			ResourceID:   "1",
			Type:         portainer.CustomTemplateResourceControl,
			UserAccesses: []portainer.UserResourceAccess{{UserID: 2}},
		})
		require.NoError(t, err)

		return nil
	})
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodDelete, "/custom_templates/1", nil)
	r = mux.SetURLVars(r, map[string]string{"id": "1"})
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{UserID: 2}))
	rr := httptest.NewRecorder()

	herr := handler.customTemplateDelete(rr, r)
	require.Nil(t, herr)
	require.Equal(t, http.StatusNoContent, rr.Code)

	err = store.ViewTx(func(tx dataservices.DataStoreTx) error {
		_, err := tx.CustomTemplate().Read(1)
		require.True(t, tx.IsErrObjectNotFound(err))

		return nil
	})
	require.NoError(t, err)
}

func TestCustomTemplateDelete_AdminCanDeleteAdminOnly(t *testing.T) {
	t.Parallel()

	handler, store, _ := newTestHandler(t)

	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		err := tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID:              1,
			CreatedByUserID: 2,
		})
		require.NoError(t, err)

		err = tx.ResourceControl().Create(&portainer.ResourceControl{
			ID:                 1,
			ResourceID:         "1",
			Type:               portainer.CustomTemplateResourceControl,
			AdministratorsOnly: true,
		})
		require.NoError(t, err)

		return nil
	})
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodDelete, "/custom_templates/1", nil)
	r = mux.SetURLVars(r, map[string]string{"id": "1"})
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{UserID: 1, IsAdmin: true}))
	rr := httptest.NewRecorder()

	herr := handler.customTemplateDelete(rr, r)
	require.Nil(t, herr)
	require.Equal(t, http.StatusNoContent, rr.Code)
}

func TestCustomTemplateDelete_PublicTemplateAllowsAnyUser(t *testing.T) {
	t.Parallel()

	handler, store, _ := newTestHandler(t)

	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		err := tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID:              1,
			CreatedByUserID: 1,
		})
		require.NoError(t, err)

		err = tx.ResourceControl().Create(&portainer.ResourceControl{
			ID:         1,
			ResourceID: "1",
			Type:       portainer.CustomTemplateResourceControl,
			Public:     true,
		})
		require.NoError(t, err)

		return nil
	})
	require.NoError(t, err)

	// User 2 is not the creator but the template is public
	r := httptest.NewRequest(http.MethodDelete, "/custom_templates/1", nil)
	r = mux.SetURLVars(r, map[string]string{"id": "1"})
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{UserID: 2}))
	rr := httptest.NewRecorder()

	herr := handler.customTemplateDelete(rr, r)
	require.Nil(t, herr)
	require.Equal(t, http.StatusNoContent, rr.Code)
}

func TestCustomTemplateDelete_NonCreatorForbiddenWithPrivateRC(t *testing.T) {
	t.Parallel()

	handler, store, _ := newTestHandler(t)

	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		err := tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID:              1,
			CreatedByUserID: 1,
		})
		require.NoError(t, err)

		err = tx.ResourceControl().Create(&portainer.ResourceControl{
			ID:           1,
			ResourceID:   "1",
			Type:         portainer.CustomTemplateResourceControl,
			UserAccesses: []portainer.UserResourceAccess{{UserID: 1}},
		})
		require.NoError(t, err)

		return nil
	})
	require.NoError(t, err)

	// User 2 is not the creator and the template has a private resource control
	r := httptest.NewRequest(http.MethodDelete, "/custom_templates/1", nil)
	r = mux.SetURLVars(r, map[string]string{"id": "1"})
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{UserID: 2}))
	rr := httptest.NewRecorder()

	herr := handler.customTemplateDelete(rr, r)
	require.NotNil(t, herr)
	require.Equal(t, http.StatusForbidden, herr.StatusCode)
}

func TestCustomTemplateDelete_CreatorDeniedWithoutAccess(t *testing.T) {
	t.Parallel()

	handler, store, _ := newTestHandler(t)

	err := store.UpdateTx(func(tx dataservices.DataStoreTx) error {
		err := tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID:              1,
			CreatedByUserID: 2,
		})
		require.NoError(t, err)

		// RC exists but only grants access to user 3, not the creator (user 2)
		err = tx.ResourceControl().Create(&portainer.ResourceControl{
			ID:           1,
			ResourceID:   "1",
			Type:         portainer.CustomTemplateResourceControl,
			UserAccesses: []portainer.UserResourceAccess{{UserID: 3}},
		})
		require.NoError(t, err)

		return nil
	})
	require.NoError(t, err)

	r := httptest.NewRequest(http.MethodDelete, "/custom_templates/1", nil)
	r = mux.SetURLVars(r, map[string]string{"id": "1"})
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{UserID: 2}))
	rr := httptest.NewRecorder()

	herr := handler.customTemplateDelete(rr, r)
	require.NotNil(t, herr)
	require.Equal(t, http.StatusForbidden, herr.StatusCode)
}

func TestREQ_TPL_03_CustomTemplateDelete_InvalidID(t *testing.T) {
	t.Parallel()

	handler, _, _ := newTestHandler(t)

	r := httptest.NewRequest(http.MethodDelete, "/custom_templates/xyz", nil)
	r = mux.SetURLVars(r, map[string]string{"id": "xyz"})
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{UserID: 1, IsAdmin: true}))
	rr := httptest.NewRecorder()

	herr := handler.customTemplateDelete(rr, r)
	require.NotNil(t, herr)
	require.Equal(t, http.StatusBadRequest, herr.StatusCode)
}

func TestREQ_TPL_03_CustomTemplateDelete_MissingSecurityContext(t *testing.T) {
	t.Parallel()

	handler, ds, _ := newTestHandler(t)

	require.NoError(t, ds.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID: 1, Title: "compose", Type: portainer.DockerComposeStack, CreatedByUserID: 1,
		})
	}))

	r := httptest.NewRequest(http.MethodDelete, "/custom_templates/1", nil)
	r = mux.SetURLVars(r, map[string]string{"id": "1"})
	rr := httptest.NewRecorder()

	herr := handler.customTemplateDelete(rr, r)
	require.NotNil(t, herr)
	require.Equal(t, http.StatusInternalServerError, herr.StatusCode)
}

func TestREQ_TPL_03_CustomTemplateDelete_AdminWithoutResourceControl(t *testing.T) {
	t.Parallel()

	handler, ds, _ := newTestHandler(t)

	require.NoError(t, ds.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID: 1, Title: "orphan-compose", Type: portainer.DockerComposeStack,
			CreatedByUserID: 1, ProjectPath: t.TempDir() + "/missing-path",
		})
	}))

	r := httptest.NewRequest(http.MethodDelete, "/custom_templates/1", nil)
	r = mux.SetURLVars(r, map[string]string{"id": "1"})
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{UserID: 1, IsAdmin: true}))
	rr := httptest.NewRecorder()

	herr := handler.customTemplateDelete(rr, r)
	require.Nil(t, herr)
	require.Equal(t, http.StatusNoContent, rr.Code)

	require.NoError(t, ds.ViewTx(func(tx dataservices.DataStoreTx) error {
		_, err := tx.CustomTemplate().Read(1)
		require.True(t, tx.IsErrObjectNotFound(err))
		return nil
	}))
}

func TestREQ_TPL_03_CustomTemplateDelete_CreatorWithTeamMembership(t *testing.T) {
	t.Parallel()

	handler, ds, _ := newTestHandler(t)

	require.NoError(t, ds.UpdateTx(func(tx dataservices.DataStoreTx) error {
		require.NoError(t, tx.CustomTemplate().Create(&portainer.CustomTemplate{
			ID: 1, Title: "team-compose", Type: portainer.DockerComposeStack, CreatedByUserID: 3,
		}))
		require.NoError(t, tx.ResourceControl().Create(&portainer.ResourceControl{
			ID: 1, ResourceID: "1", Type: portainer.CustomTemplateResourceControl,
			UserAccesses: []portainer.UserResourceAccess{{UserID: 3}},
		}))
		return nil
	}))

	r := httptest.NewRequest(http.MethodDelete, "/custom_templates/1", nil)
	r = mux.SetURLVars(r, map[string]string{"id": "1"})
	r = r.WithContext(security.StoreRestrictedRequestContext(r, &security.RestrictedRequestContext{
		UserID: 3, UserMemberships: []portainer.TeamMembership{{ID: 1, UserID: 3, TeamID: 1}},
	}))
	rr := httptest.NewRecorder()

	herr := handler.customTemplateDelete(rr, r)
	require.Nil(t, herr)
	require.Equal(t, http.StatusNoContent, rr.Code)
}
