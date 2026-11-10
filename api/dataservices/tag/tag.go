package tag

import (
	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
)

// BucketName represents the name of the bucket where this service stores data.
const BucketName = "tags"

// Service represents a service for managing environment(endpoint) data.
type Service struct {
	dataservices.BaseDataService[portainer.Tag, portainer.TagID]
}

// NewService creates a new instance of a service.
func NewService(connection portainer.Connection) (*Service, error) {
	err := connection.SetServiceName(BucketName)
	if err != nil {
		return nil, err
	}

	return &Service{
		BaseDataService: dataservices.BaseDataService[portainer.Tag, portainer.TagID]{
			Bucket:     BucketName,
			Connection: connection,
		},
	}, nil
}

// CreateTag creates a new tag.
func (service *Service) Create(tag *portainer.Tag) error {
	return service.Connection.CreateObject(
		BucketName,
		func(id uint64) (int, any) {
			tag.ID = portainer.TagID(id)
			return int(tag.ID), tag
		},
	)
}
