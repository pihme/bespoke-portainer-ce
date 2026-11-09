package websocket

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/http/security"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestWebsocketExec_deniesUnauthorizedEndpoint asserts a non-admin with no access policy on
// the environment is rejected with 403 — the environment-access (L2) gate (BE-13027).
func TestWebsocketExec_deniesUnauthorizedEndpoint(t *testing.T) {
	handler, _ := newWebsocketTestHandler(t)

	user := &portainer.User{Username: "restricted", Role: portainer.StandardUserRole}
	err := handler.DataStore.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.User().Create(user)
	})
	require.NoError(t, err)

	// exec requires a hexadecimal `id` query parameter to reach the authorization check.
	req := httptest.NewRequest(http.MethodGet, "/websocket/exec?id=abcdef&endpointId=2", nil)
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{ID: user.ID, Role: portainer.StandardUserRole}))

	handlerErr := handler.websocketExec(httptest.NewRecorder(), req)

	require.NotNil(t, handlerErr, "expected an authorization error for a denied environment")
	assert.Equal(t, http.StatusForbidden, handlerErr.StatusCode)
}

func TestREQ_CTR_12_WebsocketExec_RejectsInvalidQuery(t *testing.T) {
	handler, _ := newLocalDockerWebsocketTestHandler(t, "tcp://127.0.0.1:1")

	cases := []struct {
		name       string
		rawQuery   string
		wantStatus int
	}{
		{name: "missing id", rawQuery: "endpointId=2", wantStatus: http.StatusBadRequest},
		{name: "non-hex id", rawQuery: "id=not-hex&endpointId=2", wantStatus: http.StatusBadRequest},
		{name: "missing endpointId", rawQuery: "id=abcdef", wantStatus: http.StatusBadRequest},
		{name: "unknown endpoint", rawQuery: "id=abcdef&endpointId=999", wantStatus: http.StatusNotFound},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/websocket/exec?"+tc.rawQuery, nil)
			req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{ID: 1, Role: portainer.AdministratorRole}))

			handlerErr := handler.websocketExec(httptest.NewRecorder(), req)
			require.NotNil(t, handlerErr)
			assert.Equal(t, tc.wantStatus, handlerErr.StatusCode)
		})
	}
}

func TestREQ_CTR_12_CreateExecStartRequest_StartsTTYExec(t *testing.T) {
	t.Parallel()

	req, err := createExecStartRequest("cafebabe")
	require.NoError(t, err)
	require.NotNil(t, req)

	assert.Equal(t, http.MethodPost, req.Method)
	assert.Equal(t, "/exec/cafebabe/start", req.URL.String())
	assert.Equal(t, "application/json", req.Header.Get("Content-Type"))
	assert.Equal(t, "Upgrade", req.Header.Get("Connection"))
	assert.Equal(t, "tcp", req.Header.Get("Upgrade"))

	body, err := io.ReadAll(req.Body)
	require.NoError(t, err)

	var payload execStartOperationPayload
	require.NoError(t, json.Unmarshal(body, &payload))
	assert.True(t, payload.Tty)
	assert.False(t, payload.Detach)
}

func TestREQ_CTR_12_WebsocketExec_LocalDockerUpgradeFailureIsInternalError(t *testing.T) {
	handler, _ := newLocalDockerWebsocketTestHandler(t, "tcp://127.0.0.1:1")

	req := httptest.NewRequest(http.MethodGet, "/websocket/exec?id=abcdef&endpointId=2", nil)
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{ID: 1, Role: portainer.AdministratorRole}))

	handlerErr := handler.websocketExec(httptest.NewRecorder(), req)
	require.NotNil(t, handlerErr)
	assert.Equal(t, http.StatusInternalServerError, handlerErr.StatusCode)
}

func TestREQ_CTR_12_WebsocketExec_LocalDockerHijacksExecStart(t *testing.T) {
	dockerLn := startFakeDockerHijackServer(t, "/exec/", "start")

	handler, _ := newLocalDockerWebsocketTestHandler(t, "tcp://"+dockerLn.Addr().String())
	handler.connectionUpgrader = websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}

	errCh := make(chan *httperror.HandlerError, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r = r.WithContext(security.StoreTokenData(r, &portainer.TokenData{ID: 1, Role: portainer.AdministratorRole}))
		errCh <- handler.websocketExec(w, r)
	}))
	t.Cleanup(srv.Close)

	u := "ws" + strings.TrimPrefix(srv.URL, "http") + "/websocket/exec?id=abcdef&endpointId=2"
	client, resp, err := websocket.DefaultDialer.Dial(u, nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = resp.Body.Close() })
	t.Cleanup(func() { _ = client.Close() })

	handlerErr := <-errCh
	require.Nil(t, handlerErr)
}

func TestREQ_CTR_12_HijackExecStartOperation_DialFailure(t *testing.T) {
	t.Parallel()

	serverConn, _ := newPackageTestWSPair(t)
	endpoint := &portainer.Endpoint{URL: "tcp://127.0.0.1:1"}

	err := hijackExecStartOperation(serverConn, endpoint, "abcdef")
	require.Error(t, err)
}
