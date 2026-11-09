package websocket

import (
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/datastore"
	"github.com/portainer/portainer/api/http/security"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestWebsocketAttach_deniesUnauthorizedEndpoint asserts a non-admin with no access policy on
// the environment is rejected with 403 — the environment-access (L2) gate (BE-13027).
func TestWebsocketAttach_deniesUnauthorizedEndpoint(t *testing.T) {
	handler, _ := newWebsocketTestHandler(t)

	user := &portainer.User{Username: "restricted", Role: portainer.StandardUserRole}
	err := handler.DataStore.UpdateTx(func(tx dataservices.DataStoreTx) error {
		return tx.User().Create(user)
	})
	require.NoError(t, err)

	// attach requires a hexadecimal `id` query parameter to reach the authorization check.
	req := httptest.NewRequest(http.MethodGet, "/websocket/attach?id=abcdef&endpointId=2", nil)
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{ID: user.ID, Role: portainer.StandardUserRole}))

	handlerErr := handler.websocketAttach(httptest.NewRecorder(), req)

	require.NotNil(t, handlerErr, "expected an authorization error for a denied environment")
	assert.Equal(t, http.StatusForbidden, handlerErr.StatusCode)
}

func TestREQ_CTR_12_WebsocketAttach_RejectsInvalidQuery(t *testing.T) {
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
			req := httptest.NewRequest(http.MethodGet, "/websocket/attach?"+tc.rawQuery, nil)
			req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{ID: 1, Role: portainer.AdministratorRole}))

			handlerErr := handler.websocketAttach(httptest.NewRecorder(), req)
			require.NotNil(t, handlerErr)
			assert.Equal(t, tc.wantStatus, handlerErr.StatusCode)
		})
	}
}

func TestREQ_CTR_12_CreateAttachStartRequest_TargetsContainerAttach(t *testing.T) {
	t.Parallel()

	req, err := createAttachStartRequest("deadbeef")
	require.NoError(t, err)
	require.NotNil(t, req)

	assert.Equal(t, http.MethodPost, req.Method)
	assert.Equal(t, "/containers/deadbeef/attach?stdin=1&stdout=1&stderr=1&stream=1", req.URL.String())
	assert.Equal(t, "application/json", req.Header.Get("Content-Type"))
	assert.Equal(t, "Upgrade", req.Header.Get("Connection"))
	assert.Equal(t, "tcp", req.Header.Get("Upgrade"))
}

func TestREQ_CTR_12_WebsocketAttach_LocalDockerUpgradeFailureIsInternalError(t *testing.T) {
	handler, _ := newLocalDockerWebsocketTestHandler(t, "tcp://127.0.0.1:1")

	req := httptest.NewRequest(http.MethodGet, "/websocket/attach?id=abcdef&endpointId=2", nil)
	req = req.WithContext(security.StoreTokenData(req, &portainer.TokenData{ID: 1, Role: portainer.AdministratorRole}))

	// httptest.ResponseRecorder cannot hijack, so the websocket upgrade fails after auth.
	handlerErr := handler.websocketAttach(httptest.NewRecorder(), req)
	require.NotNil(t, handlerErr)
	assert.Equal(t, http.StatusInternalServerError, handlerErr.StatusCode)
}

func TestREQ_CTR_12_WebsocketAttach_LocalDockerHijacksAttachStart(t *testing.T) {
	dockerLn := startFakeDockerHijackServer(t, "/containers/", "attach")

	handler, _ := newLocalDockerWebsocketTestHandler(t, "tcp://"+dockerLn.Addr().String())
	handler.connectionUpgrader = websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}

	errCh := make(chan *httperror.HandlerError, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r = r.WithContext(security.StoreTokenData(r, &portainer.TokenData{ID: 1, Role: portainer.AdministratorRole}))
		errCh <- handler.websocketAttach(w, r)
	}))
	t.Cleanup(srv.Close)

	u := "ws" + strings.TrimPrefix(srv.URL, "http") + "/websocket/attach?id=abcdef&endpointId=2"
	client, resp, err := websocket.DefaultDialer.Dial(u, nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = resp.Body.Close() })
	t.Cleanup(func() { _ = client.Close() })

	handlerErr := <-errCh
	require.Nil(t, handlerErr)
}

func TestREQ_CTR_12_HijackAttachStartOperation_DialFailure(t *testing.T) {
	t.Parallel()

	serverConn, _ := newPackageTestWSPair(t)
	endpoint := &portainer.Endpoint{URL: "tcp://127.0.0.1:1"}

	err := hijackAttachStartOperation(serverConn, endpoint, "abcdef")
	require.Error(t, err)
}

// newLocalDockerWebsocketTestHandler builds a Handler with a local Docker environment at the
// given URL and a real bouncer. Shared by local console attach/exec coverage (REQ-CTR-12).
func newLocalDockerWebsocketTestHandler(t *testing.T, dockerURL string) (*Handler, *portainer.Endpoint) {
	t.Helper()

	_, store := datastore.MustNewTestStore(t, true, false)

	endpoint := &portainer.Endpoint{
		ID:      2,
		Name:    "local-docker",
		Type:    portainer.DockerEnvironment,
		GroupID: 1,
		URL:     dockerURL,
	}
	require.NoError(t, store.Endpoint().Create(endpoint))

	bouncer := security.NewRequestBouncer(t.Context(), store, nil, nil)
	handler := &Handler{
		DataStore:          store,
		requestBouncer:     bouncer,
		connectionUpgrader: websocket.Upgrader{},
	}
	return handler, endpoint
}

// startFakeDockerHijackServer accepts one TCP connection, reads the Docker hijack HTTP request,
// asserts it targets the expected path prefix, answers 101 Switching Protocols, then closes.
func startFakeDockerHijackServer(t *testing.T, pathPrefix, pathFragment string) net.Listener {
	t.Helper()

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = ln.Close() })

	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()

		buf := make([]byte, 4096)
		n, err := conn.Read(buf)
		if err != nil && err != io.EOF {
			return
		}
		reqLine := string(buf[:n])
		if !strings.Contains(reqLine, pathPrefix) || !strings.Contains(reqLine, pathFragment) {
			return
		}

		_, _ = conn.Write([]byte("HTTP/1.1 101 Switching Protocols\r\nUpgrade: tcp\r\nConnection: Upgrade\r\n\r\n"))
	}()

	return ln
}

// newPackageTestWSPair upgrades a single websocket connection for unit tests that need a
// server-side *websocket.Conn without going through the HTTP handlers.
func newPackageTestWSPair(t *testing.T) (*websocket.Conn, *websocket.Conn) {
	t.Helper()

	connCh := make(chan *websocket.Conn, 1)
	doneCh := make(chan struct{})
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if !assert.NoError(t, err) {
			return
		}
		connCh <- conn
		<-doneCh
	}))
	t.Cleanup(func() {
		close(doneCh)
		srv.Close()
	})

	u := "ws" + strings.TrimPrefix(srv.URL, "http")
	client, resp, err := websocket.DefaultDialer.Dial(u, nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = resp.Body.Close() })
	t.Cleanup(func() { _ = client.Close() })

	server := <-connCh
	t.Cleanup(func() { _ = server.Close() })
	return server, client
}
