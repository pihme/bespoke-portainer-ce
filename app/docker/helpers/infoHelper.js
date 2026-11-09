angular.module('portainer.docker').factory('InfoHelper', [
  function InfoHelperFactory() {
    'use strict';

    var helper = {};

    // Docker Swarm is removed (TAI-003): every Docker engine is managed as a
    // standalone engine, even when it is part of a Swarm.
    helper.determineEndpointMode = function (_info, type) {
      var mode = {
        provider: 'DOCKER_STANDALONE',
        role: '',
        agentProxy: false,
      };

      if (type === 2 || type === 4) {
        mode.agentProxy = true;
      }

      return mode;
    };

    return helper;
  },
]);
