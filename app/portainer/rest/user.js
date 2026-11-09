angular.module('portainer.app').factory('Users', [
  '$resource',
  'API_ENDPOINT_USERS',
  function UsersFactory($resource, API_ENDPOINT_USERS) {
    'use strict';
    return $resource(
      API_ENDPOINT_USERS + '/:id',
      {},
      {
        get: { method: 'GET', params: { id: '@id' } },
        updateTheme: { method: 'PUT', params: { id: '@id' } },
      }
    );
  },
]);
