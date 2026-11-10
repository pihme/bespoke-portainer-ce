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

// RemoveTeamAccessPolicies will remove all existing access policies associated to the specified team
func (service *Service) RemoveTeamAccessPolicies(tx dataservices.DataStoreTx, teamID portainer.TeamID) error {
	endpoints, err := tx.Endpoint().Endpoints()
	if err != nil {
		return err
	}
	for _, endpoint := range endpoints {
		for policyTeamID := range endpoint.TeamAccessPolicies {
			if policyTeamID == teamID {
				delete(endpoint.TeamAccessPolicies, policyTeamID)

				err := tx.Endpoint().UpdateEndpoint(endpoint.ID, &endpoint)
				if err != nil {
					return err
				}

				break
			}
		}
	}

	endpointGroups, err := tx.EndpointGroup().ReadAll()
	if err != nil {
		return err
	}

	for _, endpointGroup := range endpointGroups {
		for policyTeamID := range endpointGroup.TeamAccessPolicies {
			if policyTeamID == teamID {
				delete(endpointGroup.TeamAccessPolicies, policyTeamID)

				err := tx.EndpointGroup().Update(endpointGroup.ID, &endpointGroup)
				if err != nil {
					return err
				}

				break
			}
		}
	}

	registries, err := tx.Registry().ReadAll()
	if err != nil {
		return err
	}

	// iterate over all environments for all registries
	// and evict all direct accesses to the registries the team had
	// we could have built a range of the teams's environments accesses while removing them above
	// but ranging over all environments (registryAccessPolicy is indexed by environmentId)
	// makes sure we cleanup all resources in case an access was not removed when a team was removed from an env
	for _, registry := range registries {
		updateRegistry := false
		for _, registryAccessPolicy := range registry.RegistryAccesses {
			if _, ok := registryAccessPolicy.TeamAccessPolicies[teamID]; ok {
				delete(registryAccessPolicy.TeamAccessPolicies, teamID)
				updateRegistry = true
			}
		}
		if updateRegistry {
			if err := tx.Registry().Update(registry.ID, &registry); err != nil {
				return err
			}
		}
	}

	return nil
}

// RemoveUserAccessPolicies will remove all existing access policies associated to the specified user
func (service *Service) RemoveUserAccessPolicies(tx dataservices.DataStoreTx, userID portainer.UserID) error {
	endpoints, err := tx.Endpoint().Endpoints()
	if err != nil {
		return err
	}

	for _, endpoint := range endpoints {
		for policyUserID := range endpoint.UserAccessPolicies {
			if policyUserID == userID {
				delete(endpoint.UserAccessPolicies, policyUserID)

				err := tx.Endpoint().UpdateEndpoint(endpoint.ID, &endpoint)
				if err != nil {
					return err
				}

				break
			}
		}
	}

	endpointGroups, err := tx.EndpointGroup().ReadAll()
	if err != nil {
		return err
	}

	for _, endpointGroup := range endpointGroups {
		for policyUserID := range endpointGroup.UserAccessPolicies {
			if policyUserID == userID {
				delete(endpointGroup.UserAccessPolicies, policyUserID)

				err := tx.EndpointGroup().Update(endpointGroup.ID, &endpointGroup)
				if err != nil {
					return err
				}

				break
			}
		}
	}

	registries, err := tx.Registry().ReadAll()
	if err != nil {
		return err
	}

	// iterate over all environments for all registries
	// and evict all direct accesses to the registries the user had
	// we could have built a range of the user's environments accesses while removing them above
	// but ranging over all environments (registryAccessPolicy is indexed by environmentId)
	// makes sure we cleanup all resources in case an access was not removed when a user was removed from an env
	for _, registry := range registries {
		updateRegistry := false
		for _, registryAccessPolicy := range registry.RegistryAccesses {
			if _, ok := registryAccessPolicy.UserAccessPolicies[userID]; ok {
				delete(registryAccessPolicy.UserAccessPolicies, userID)
				updateRegistry = true
			}
		}
		if updateRegistry {
			if err := tx.Registry().Update(registry.ID, &registry); err != nil {
				return err
			}
		}
	}

	return nil
}

// UpdateUsersAuthorizations is a no-op kept for backward compatibility with database migrations.
//
// Deprecated: This function previously populated the User.EndpointAuthorizations field which is
// no longer used.
func (service *Service) UpdateUsersAuthorizations() error {
	return nil
}

func (service *Service) UserIsAdminOrAuthorized(tx dataservices.DataStoreTx, userID portainer.UserID, endpointID portainer.EndpointID, authorizations []portainer.Authorization) (bool, error) {
	user, err := tx.User().Read(userID)
	if err != nil {
		return false, err
	}

	if user.Role == portainer.AdministratorRole {
		return true, nil
	}

	for _, authorization := range authorizations {
		_, authorized := user.EndpointAuthorizations[endpointID][authorization]
		if authorized {
			return true, nil
		}
	}

	return false, nil
}
