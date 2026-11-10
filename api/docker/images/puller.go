package images

import (
	"context"
	"io"

	"github.com/portainer/portainer/api/logs"

	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
	"github.com/rs/zerolog/log"
)

type Puller struct {
	client *client.Client
}

func NewPuller(client *client.Client) *Puller {
	return &Puller{client: client}
}

// Pull pulls the image without registry auth: there are no stored registries
// (TAI-023), so no registry ever matched the image.
func (puller *Puller) Pull(ctx context.Context, img Image) error {
	log.Debug().Str("image", img.FullName()).Msg("starting to pull the image")

	out, err := puller.client.ImagePull(ctx, img.FullName(), image.PullOptions{})
	if err != nil {
		return err
	}
	defer logs.CloseAndLogErr(out)

	_, err = io.ReadAll(out)

	return err
}
