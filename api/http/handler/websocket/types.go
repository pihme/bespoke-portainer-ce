package websocket

import portainer "github.com/portainer/portainer/api"

type webSocketRequestParams struct {
	ID       string
	endpoint *portainer.Endpoint
}
