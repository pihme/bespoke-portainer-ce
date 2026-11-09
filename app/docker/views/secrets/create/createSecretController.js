angular.module('portainer.docker').controller('CreateSecretController', [
  '$scope',
  '$state',
  'Notifications',
  'SecretService',
  'LabelHelper',
  function ($scope, $state, Notifications, SecretService, LabelHelper) {
    $scope.formValues = {
      Name: '',
      Data: '',
      Labels: [],
      encodeSecret: true,
    };

    $scope.state = {
      formValidationError: '',
      actionInProgress: false,
    };

    $scope.handleEncodeSecretChange = handleEncodeSecretChange;

    function handleEncodeSecretChange(checked) {
      return $scope.$evalAsync(() => {
        $scope.formValues.encodeSecret = checked;
      });
    }

    $scope.addLabel = function () {
      $scope.formValues.Labels.push({ key: '', value: '' });
    };

    $scope.removeLabel = function (index) {
      $scope.formValues.Labels.splice(index, 1);
    };

    function prepareLabelsConfig(config) {
      config.Labels = LabelHelper.fromKeyValueToLabelHash($scope.formValues.Labels);
    }

    function prepareSecretData(config) {
      if ($scope.formValues.encodeSecret) {
        config.Data = btoa(unescape(encodeURIComponent($scope.formValues.Data)));
      } else {
        config.Data = $scope.formValues.Data;
      }
    }

    function prepareConfiguration() {
      var config = {};
      config.Name = $scope.formValues.Name;
      prepareSecretData(config);
      prepareLabelsConfig(config);
      return config;
    }

    $scope.create = function () {
      $scope.state.actionInProgress = true;
      var secretConfiguration = prepareConfiguration();
      SecretService.create(secretConfiguration)
        .then(function success() {
          Notifications.success('Success', 'Secret successfully created');
          $state.go('docker.secrets', {}, { reload: true });
        })
        .catch(function error(err) {
          Notifications.error('Failure', err, 'Unable to create secret');
        })
        .finally(function final() {
          $scope.state.actionInProgress = false;
        });
    };
  },
]);
