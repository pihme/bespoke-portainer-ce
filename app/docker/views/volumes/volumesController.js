import { processItemsInBatches } from '@/react/common/processItemsInBatches';

angular.module('portainer.docker').controller('VolumesController', [
  '$q',
  '$scope',
  '$state',
  'VolumeService',
  'Notifications',
  'Authentication',
  'endpoint',
  function ($q, $scope, $state, VolumeService, Notifications, Authentication, endpoint) {
    $scope.removeAction = async function (selectedItems) {
      async function doRemove(volume) {
        return VolumeService.remove(volume.Name, volume.NodeName)
          .then(function success() {
            Notifications.success('Volume successfully removed', volume.Name);
            var index = $scope.volumes.indexOf(volume);
            $scope.volumes.splice(index, 1);
          })
          .catch(function error(err) {
            Notifications.error('Failure', err, 'Unable to remove volume');
          });
      }

      await processItemsInBatches(selectedItems, doRemove);
      $state.reload();
    };

    $scope.getVolumes = getVolumes;
    function getVolumes() {
      $q.all({
        attached: VolumeService.volumes({ dangling: ['false'] }),
        dangling: VolumeService.volumes({ dangling: ['true'] }),
      })
        .then(function success(data) {
          $scope.volumes = data.attached
            .map(function (volume) {
              volume.dangling = false;
              return volume;
            })
            .concat(
              data.dangling.map(function (volume) {
                volume.dangling = true;
                return volume;
              })
            );
        })
        .catch(function error(err) {
          Notifications.error('Failure', err, 'Unable to retrieve volumes');
        });
    }

    function initView() {
      // The volume file browser is removed (TAI-010).
      getVolumes();
    }

    initView();
  },
]);
