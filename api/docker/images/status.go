package images

import (
	"time"

	"github.com/patrickmn/go-cache"
)

var (
	statusCache = cache.New(24*time.Hour, 24*time.Hour)
)

func EvictImageStatus(resourceID string) {
	statusCache.Delete(resourceID)
}
