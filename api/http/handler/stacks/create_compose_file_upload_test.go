package stacks

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func composeFileUploadBody(t *testing.T, name, fileContent, envJSON string) (*bytes.Buffer, string) {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	require.NoError(t, w.WriteField("Name", name))
	if envJSON != "" {
		require.NoError(t, w.WriteField("Env", envJSON))
	}
	part, err := w.CreateFormFile("file", "docker-compose.yml")
	require.NoError(t, err)
	_, err = part.Write([]byte(fileContent))
	require.NoError(t, err)
	require.NoError(t, w.Close())
	return &body, w.FormDataContentType()
}

func TestREQ_STK_02_CreateComposeFromFileUpload_PersistsStack(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	envJSON, _ := json.Marshal([]portainer.Pair{{Name: "K", Value: "V"}})
	body, contentType := composeFileUploadBody(t, "upload-compose", "services:\n  web:\n    image: alpine\n", string(envJSON))

	url := fmt.Sprintf("/stacks/create/standalone/file?endpointId=%d", endpoint.ID)
	req := stackCreateRequestWithToken(http.MethodPost, url, body.Bytes())
	req.Header.Set("Content-Type", contentType)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var resp portainer.Stack
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "upload-compose", resp.Name)
	assert.Equal(t, portainer.DockerComposeStack, resp.Type)
	assert.Equal(t, []portainer.Pair{{Name: "K", Value: "V"}}, resp.Env)
}

func TestREQ_STK_02_CreateComposeFromFileUpload_MissingName_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, err := mw.CreateFormFile("file", "docker-compose.yml")
	require.NoError(t, err)
	_, _ = part.Write([]byte("services: {}\n"))
	require.NoError(t, mw.Close())

	url := fmt.Sprintf("/stacks/create/standalone/file?endpointId=%d", endpoint.ID)
	req := stackCreateRequestWithToken(http.MethodPost, url, body.Bytes())
	req.Header.Set("Content-Type", mw.FormDataContentType())
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_02_CreateComposeFromFileUpload_MissingFile_ReturnsBadRequest(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	require.NoError(t, mw.WriteField("Name", "nofile"))
	require.NoError(t, mw.Close())

	url := fmt.Sprintf("/stacks/create/standalone/file?endpointId=%d", endpoint.ID)
	req := stackCreateRequestWithToken(http.MethodPost, url, body.Bytes())
	req.Header.Set("Content-Type", mw.FormDataContentType())
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestREQ_STK_02_CreateComposeFromFileUpload_DuplicateName_ReturnsConflict(t *testing.T) {
	t.Parallel()
	h, store := newStackCreateHandler(t)
	_, err := mockCreateUser(store)
	require.NoError(t, err)
	endpoint, err := mockCreateEndpoint(store)
	require.NoError(t, err)
	require.NoError(t, store.Stack().Create(&portainer.Stack{
		ID: 7, Name: "dup-upload", Type: portainer.DockerComposeStack, EndpointID: endpoint.ID,
	}))

	body, contentType := composeFileUploadBody(t, "dup-upload", "services:\n  web:\n    image: alpine\n", "")
	url := fmt.Sprintf("/stacks/create/standalone/file?endpointId=%d", endpoint.ID)
	req := stackCreateRequestWithToken(http.MethodPost, url, body.Bytes())
	req.Header.Set("Content-Type", contentType)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	assert.Equal(t, http.StatusConflict, w.Code)
}
