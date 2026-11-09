import { UserViewModel } from '@/portainer/models/user';
import { getUser } from '@/portainer/users/queries/useUser';

// Only the local operator exists (TAI-001); the service reads it and stores its theme.
/* @ngInject */
export function UserService(Users) {
  'use strict';
  var service = {};

  service.user = async function (userId) {
    const user = await getUser(userId);

    return new UserViewModel(user);
  };

  service.updateUserTheme = function (id, theme) {
    return Users.updateTheme({ id }, { theme }).$promise;
  };

  return service;
}
