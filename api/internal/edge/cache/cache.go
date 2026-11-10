package cache

import (
	"strconv"

	"github.com/VictoriaMetrics/fastcache"
	portainer "github.com/portainer/portainer/api"
)

var c = fastcache.New(1)

func key(k portainer.EndpointID) []byte {
	return []byte(strconv.Itoa(int(k)))
}

func Del(k portainer.EndpointID) {
	c.Del(key(k))
}
