angular.module('portainer.docker').controller('HostViewController', [
  '$q',
  'SystemService',
  'Notifications',
  'StateManager',
  'Authentication',
  function HostViewController($q, SystemService, Notifications, StateManager, Authentication) {
    var ctrl = this;

    this.$onInit = initView;

    ctrl.state = {
      isAgent: false,
      isAdmin: false,
    };

    this.engineDetails = {};
    this.hostDetails = {};

    function initView() {
      var applicationState = StateManager.getState();
      ctrl.state.isAgent = applicationState.endpoint.mode.agentProxy;
      ctrl.state.isAdmin = Authentication.isAdmin();
      var agentApiVersion = applicationState.endpoint.agentApiVersion;
      ctrl.state.agentApiVersion = agentApiVersion;
      ctrl.state.enableHostManagementFeatures = ctrl.endpoint.SecuritySettings.enableHostManagementFeatures;

      $q.all({
        version: SystemService.version(),
        info: SystemService.info(),
      })
        .then(function success(data) {
          ctrl.engineDetails = buildEngineDetails(data);
          ctrl.hostDetails = buildHostDetails(data.info);
        })
        .catch(function error(err) {
          Notifications.error('Failure', err, 'Unable to retrieve engine details');
        });
    }

    function buildEngineDetails(data) {
      var versionDetails = data.version;
      var info = data.info;
      return {
        releaseVersion: versionDetails.Version,
        apiVersion: versionDetails.ApiVersion,
        rootDirectory: info.DockerRootDir,
        storageDriver: info.Driver,
        loggingDriver: info.LoggingDriver,
        volumePlugins: info.Plugins.Volume,
        networkPlugins: info.Plugins.Network,
      };
    }

    function buildHostDetails(info) {
      return {
        os: {
          arch: info.Architecture,
          type: info.OSType,
          name: info.OperatingSystem,
        },
        name: info.Name,
        kernelVersion: info.KernelVersion,
        totalCPU: info.NCPU,
        totalMemory: info.MemTotal,
      };
    }
  },
]);
