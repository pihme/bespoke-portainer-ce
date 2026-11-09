import { getOptions } from '@/react/docker/networks/CreateView/macvlanOptions';

angular.module('portainer.docker').controller('NetworkMacvlanFormController', [
  'NetworkService',
  'Notifications',
  '$scope',
  function (NetworkService, Notifications, $scope) {
    var ctrl = this;

    this.options = [];

    ctrl.requiredConfigSelection = function () {
      if (ctrl.data.Scope !== 'swarm') {
        return false;
      }
      return !ctrl.data.SelectedNetworkConfig;
    };

    this.onChangeScope = onChangeScope.bind(this);
    function onChangeScope(value) {
      return $scope.$evalAsync(() => {
        this.data.Scope = value;
      });
    }

    this.$onInit = $onInit;
    function $onInit() {
      NetworkService.networks(true, false, false)
        .then(function success(networks) {
          ctrl.availableNetworks = networks.filter(function (item) {
            return item.ConfigOnly === true;
          });

          ctrl.options = getOptions(ctrl.availableNetworks.length > 0);
        })
        .catch(function error(err) {
          Notifications.error('Failure', err, 'Unable to retrieve informations for macvlan');
        });
    }
  },
]);
