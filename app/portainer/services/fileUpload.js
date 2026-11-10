angular.module('portainer.app').factory('FileUploadService', FileUploadFactory);

/* @ngInject */
function FileUploadFactory($q, Upload) {
  var service = {
    // createComposeStack, // stack service
    // createCustomTemplate, // custom template service
    // configureRegistry, // registry service
    // uploadTLSFilesForEndpoint, // endpoint service
    // uploadOwnershipVoucher, // import device controller
  };

  function uploadFile(url, file) {
    return Upload.upload({ url: url, data: { file: file } });
  }

  service.createComposeStack = function (stackName, file, env, endpointId, webhook) {
    return Upload.upload({
      url: `api/stacks/create/standalone/file?endpointId=${endpointId}`,
      data: {
        file: file,
        Name: stackName,
        Env: Upload.json(env),
        Webhook: webhook,
      },
      ignoreLoadingBar: true,
    });
  };

  service.createCustomTemplate = function createCustomTemplate(data) {
    return Upload.upload({
      url: 'api/custom_templates/create/file',
      data,
      ignoreLoadingBar: true,
    });
  };

  service.uploadTLSFilesForEndpoint = function (endpointID, TLSCAFile, TLSCertFile, TLSKeyFile) {
    var queue = [];

    if (TLSCAFile) {
      queue.push(uploadFile('api/upload/tls/ca?folder=' + endpointID, TLSCAFile));
    }
    if (TLSCertFile) {
      queue.push(uploadFile('api/upload/tls/cert?folder=' + endpointID, TLSCertFile));
    }
    if (TLSKeyFile) {
      queue.push(uploadFile('api/upload/tls/key?folder=' + endpointID, TLSKeyFile));
    }

    return $q.all(queue);
  };

  return service;
}
