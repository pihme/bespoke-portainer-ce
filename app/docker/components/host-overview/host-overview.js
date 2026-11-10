angular.module('portainer.docker').component('hostOverview', {
  templateUrl: './host-overview.html',
  bindings: {
    hostDetails: '<',
    engineDetails: '<',
    isAgent: '<',
    agentApiVersion: '<',
    refreshUrl: '@',
    browseUrl: '@',
    hostFeaturesEnabled: '<',
    isAdmin: '<',
  },
  transclude: true,
});
