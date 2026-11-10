import { TemplateViewModel } from '@/react/portainer/templates/app-templates/view-model';

angular.module('portainer.app').factory('TemplateService', TemplateServiceFactory);

/* @ngInject */
function TemplateServiceFactory($q, Templates) {
  var service = {
    templates,
  };

  function templates() {
    const deferred = $q.defer();

    Templates.query()
      .$promise.then(function success(templates) {
        const version = templates.version;
        deferred.resolve(
          templates.templates.map((item) => {
            try {
              return new TemplateViewModel(item, version);
            } catch (err) {
              deferred.reject({ msg: 'Unable to retrieve templates', err: err });
            }
          })
        );
      })
      .catch(function error(err) {
        deferred.reject({ msg: 'Unable to retrieve templates', err: err });
      });

    return deferred.promise;
  }

  service.templateFile = templateFile;
  function templateFile(repositoryUrl, composeFilePathInRepository) {
    return Templates.file({ repositoryUrl, composeFilePathInRepository }).$promise;
  }

  return service;
}
