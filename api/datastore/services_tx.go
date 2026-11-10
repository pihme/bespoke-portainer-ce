package datastore

import (
	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
)

type StoreTx struct {
	store *Store
	tx    portainer.Transaction
}

func (tx *StoreTx) IsErrObjectNotFound(err error) bool {
	return tx.store.IsErrObjectNotFound(err)
}

func (tx *StoreTx) CustomTemplate() dataservices.CustomTemplateService {
	return tx.store.CustomTemplateService.Tx(tx.tx)
}

func (tx *StoreTx) Endpoint() dataservices.EndpointService {
	return tx.store.EndpointService.Tx(tx.tx)
}

func (tx *StoreTx) EndpointGroup() dataservices.EndpointGroupService {
	return tx.store.EndpointGroupService.Tx(tx.tx)
}

func (tx *StoreTx) ResourceControl() dataservices.ResourceControlService {
	return tx.store.ResourceControlService.Tx(tx.tx)
}

func (tx *StoreTx) Settings() dataservices.SettingsService {
	return tx.store.SettingsService.Tx(tx.tx)
}

func (tx *StoreTx) Snapshot() dataservices.SnapshotService {
	return tx.store.SnapshotService.Tx(tx.tx)
}

func (tx *StoreTx) Source() dataservices.SourceService {
	return tx.store.SourceService.Tx(tx.tx)
}

func (tx *StoreTx) SSLSettings() dataservices.SSLSettingsService {
	return tx.store.SSLSettingsService.Tx(tx.tx)
}

func (tx *StoreTx) Stack() dataservices.StackService {
	return tx.store.StackService.Tx(tx.tx)
}

func (tx *StoreTx) User() dataservices.UserService {
	return tx.store.UserService.Tx(tx.tx)
}

func (tx *StoreTx) Version() dataservices.VersionService { return nil }

func (tx *StoreTx) Workflow() dataservices.WorkflowService {
	return tx.store.WorkflowService.Tx(tx.tx)
}
