angular.module('portainer.app').factory('EndpointService', [
  '$q',
  'Endpoints',
  'FileUploadService',
  function EndpointServiceFactory($q, Endpoints, FileUploadService) {
    'use strict';
    var service = {
      updateSecuritySettings,
    };

    service.endpoint = function (endpointID) {
      return Endpoints.get({ id: endpointID }).$promise;
    };

    service.snapshotEndpoints = function () {
      return Endpoints.snapshots({}, {}).$promise;
    };

    service.snapshotEndpoint = function (endpointID) {
      return Endpoints.snapshot({ id: endpointID }, {}).$promise;
    };

    service.updateAccess = function (id, userAccessPolicies, teamAccessPolicies) {
      return Endpoints.updateAccess({ id: id }, { UserAccessPolicies: userAccessPolicies, TeamAccessPolicies: teamAccessPolicies }).$promise;
    };

    service.disassociateEndpoint = function (endpointID) {
      return Endpoints.disassociate({ id: endpointID }).$promise;
    };

    service.updateEndpoint = function (id, payload) {
      var deferred = $q.defer();
      FileUploadService.uploadTLSFilesForEndpoint(id, payload.TLSCACert, payload.TLSCert, payload.TLSKey)
        .then(function success() {
          deferred.notify({ upload: false });
          return Endpoints.update({ id: id }, payload).$promise;
        })
        .then(function success(data) {
          deferred.resolve(data);
        })
        .catch(function error(err) {
          deferred.notify({ upload: false });
          deferred.reject({ msg: 'Unable to update environment', err: err });
        });
      return deferred.promise;
    };

    service.deleteEndpoint = function (endpointID) {
      return Endpoints.remove({ id: endpointID }).$promise;
    };

    service.trust = function (id) {
      Endpoints.updateEndpoint({ id }, { UserTrusted: true }).$promise;
    };

    return service;

    function updateSecuritySettings(id, securitySettings) {
      return Endpoints.updateSecuritySettings({ id }, securitySettings).$promise;
    }
  },
]);
