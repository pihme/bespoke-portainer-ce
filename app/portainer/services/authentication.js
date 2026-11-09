import { hasAuthorizations as useUserHasAuthorization } from '@/react/hooks/useUser';
import { getCurrentUser } from '../users/queries/useLoadCurrentUser';
import * as userHelpers from '../users/user.helpers';

// Login and user management are removed (TAI-001): the UI always acts as the
// local operator returned by GET /api/users/me. There is no login or logout.
angular.module('portainer.app').factory('Authentication', [
  '$async',
  '$state',
  'LocalStorage',
  'EndpointProvider',
  'ThemeManager',
  function AuthenticationFactory($async, $state, LocalStorage, EndpointProvider, ThemeManager) {
    'use strict';

    var user = {};

    return {
      init,
      isAuthenticated,
      getUserDetails,
      isAdmin,
      isEdgeAdmin,
      isPureAdmin,
      hasAuthorizations,
      redirectIfUnauthorized,
    };

    async function initAsync() {
      const userId = LocalStorage.getUserId();
      if (userId && user.ID === userId) {
        return true;
      }
      await loadUserData();
      return true;
    }

    function init() {
      return $async(initAsync);
    }

    function isAuthenticated() {
      return !!user.ID;
    }

    function getUserDetails() {
      return user;
    }

    async function loadUserData() {
      const userData = await getCurrentUser();
      user.username = userData.Username;
      user.ID = userData.Id;
      user.role = userData.Role;
      user.endpointAuthorizations = userData.EndpointAuthorizations;
      user.portainerAuthorizations = userData.PortainerAuthorizations;

      // Initialize user theme base on UserTheme from database
      const userTheme = userData.ThemeSettings ? userData.ThemeSettings.color : 'auto';
      if (userTheme === 'auto' || !userTheme) {
        ThemeManager.autoTheme();
      } else {
        ThemeManager.setTheme(userTheme);
      }

      LocalStorage.storeUserId(userData.Id);
    }

    // To avoid creating divergence between CE and EE
    // isAdmin checks if the user is a portainer admin or edge admin

    function isEdgeAdmin(noEnvScope = false) {
      const environment = EndpointProvider.currentEndpoint();
      return userHelpers.isEdgeAdmin({ Role: user.role }, noEnvScope ? undefined : environment);
    }

    /**
     * @deprecated use Authentication.isAdmin instead
     */
    function isAdmin(noEnvScope = false) {
      return isEdgeAdmin(noEnvScope);
    }

    // To avoid creating divergence between CE and EE
    // isPureAdmin checks if the user is portainer admin only
    function isPureAdmin() {
      return userHelpers.isPureAdmin({ Role: user.role });
    }

    function hasAuthorizations(authorizations) {
      const endpointId = EndpointProvider.endpointID();

      if (isEdgeAdmin()) {
        return true;
      }

      return useUserHasAuthorization(
        {
          EndpointAuthorizations: user.endpointAuthorizations,
        },
        authorizations,
        endpointId
      );
    }

    function redirectIfUnauthorized(authorizations) {
      const authorized = hasAuthorizations(authorizations);
      if (!authorized) {
        $state.go('portainer.home');
      }
    }
  },
]);
