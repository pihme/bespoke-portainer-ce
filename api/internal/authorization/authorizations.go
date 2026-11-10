package authorization

import (
	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
)

// Service represents a service used to
// update authorizations associated to a user or team.
type Service struct {
	dataStore dataservices.DataStoreTx
}

// NewService returns a point to a new Service instance.
func NewService(dataStore dataservices.DataStoreTx) *Service {
	return &Service{
		dataStore: dataStore,
	}
}

// DefaultPortainerAuthorizations returns the default Portainer authorizations used by non-admin users.
func DefaultPortainerAuthorizations() portainer.Authorizations {
	return map[portainer.Authorization]bool{
		portainer.OperationPortainerDockerHubInspect:  true,
		portainer.OperationPortainerEndpointGroupList: true,
		portainer.OperationPortainerEndpointList:      true,
		portainer.OperationPortainerEndpointInspect:   true,
		portainer.OperationPortainerMOTD:              true,
		portainer.OperationPortainerRegistryList:      true,
		portainer.OperationPortainerRegistryInspect:   true,
		portainer.OperationPortainerTeamList:          true,
		portainer.OperationPortainerTemplateList:      true,
		portainer.OperationPortainerTemplateInspect:   true,
		portainer.OperationPortainerUserList:          true,
		portainer.OperationPortainerUserInspect:       true,
		portainer.OperationPortainerUserMemberships:   true,
		portainer.OperationPortainerUserListToken:     true,
		portainer.OperationPortainerUserCreateToken:   true,
		portainer.OperationPortainerUserRevokeToken:   true,
	}
}

// UpdateUsersAuthorizations is a no-op kept for backward compatibility with database migrations.
//
// Deprecated: This function previously populated the User.EndpointAuthorizations field which is
// no longer used.
func (service *Service) UpdateUsersAuthorizations() error {
	return nil
}
