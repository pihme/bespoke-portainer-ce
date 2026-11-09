import _ from 'lodash-es';
import { transformAutoUpdateViewModel } from '@/react/portainer/gitops/AutoUpdateFieldset/utils';
import { StackViewModel } from '@/react/docker/stacks/view-models/stack';

angular.module('portainer.app').factory('StackService', [
  '$q',
  'Stack',
  'FileUploadService',
  'StackHelper',
  'ContainerService',
  function StackServiceFactory($q, Stack, FileUploadService, StackHelper, ContainerService) {
    'use strict';
    var service = {
      updateGit,
    };

    service.stack = function (id) {
      var deferred = $q.defer();

      Stack.get({ id: id })
        .$promise.then(function success(data) {
          var stack = new StackViewModel(data);
          deferred.resolve(stack);
        })
        .catch(function error(err) {
          deferred.reject({ msg: 'Unable to retrieve stack details', err: err });
        });

      return deferred.promise;
    };

    service.getStackFile = function (id) {
      var deferred = $q.defer();

      Stack.getStackFile({ id: id })
        .$promise.then(function success(data) {
          deferred.resolve(data.StackFileContent);
        })
        .catch(function error(err) {
          deferred.reject({ msg: 'Unable to retrieve stack content', err: err });
        });

      return deferred.promise;
    };

    // Docker Swarm is removed (TAI-003): only Compose stacks are listed.
    service.stacks = function (compose, endpointId, includeOrphanedStacks = false) {
      var deferred = $q.defer();

      var queries = [];
      if (compose) {
        queries.push(service.composeStacks(endpointId, true, { EndpointID: endpointId, IncludeOrphanedStacks: includeOrphanedStacks }));
      }

      $q.all(queries)
        .then(function success(data) {
          var stacks = [];
          if (data[0]) {
            stacks = stacks.concat(data[0]);
          }
          deferred.resolve(stacks);
        })
        .catch(function error(err) {
          deferred.reject({ msg: 'Unable to retrieve stacks', err: err });
        });

      return deferred.promise;
    };

    service.externalComposeStacks = function (environmentId) {
      var deferred = $q.defer();

      ContainerService.containers(environmentId, 1)
        .then(function success(containers) {
          deferred.resolve(StackHelper.getExternalStacksFromContainers(containers));
        })
        .catch(function error(err) {
          deferred.reject({ msg: 'Unable to retrieve external stacks', err: err });
        });

      return deferred.promise;
    };

    service.unionStacks = function (stacks, externalStacks) {
      stacks.forEach((stack) => {
        externalStacks.forEach((externalStack) => {
          if (stack.Orphaned && stack.Name == externalStack.Name) {
            stack.OrphanedRunning = true;
          }
        });
      });
      const result = _.unionWith(stacks, externalStacks, function (a, b) {
        return a.Name === b.Name;
      });

      return result;
    };

    service.composeStacks = function (endpointId, includeExternalStacks, filters) {
      var deferred = $q.defer();

      $q.all({
        stacks: Stack.query({ filters: filters }).$promise,
        externalStacks: includeExternalStacks ? service.externalComposeStacks(endpointId) : [],
      })
        .then(function success(data) {
          var stacks = data.stacks.map(function (item) {
            return new StackViewModel(item, item.EndpointId != endpointId);
          });

          var externalStacks = data.externalStacks;
          const result = service.unionStacks(stacks, externalStacks);
          deferred.resolve(result);
        })
        .catch(function error(err) {
          deferred.reject({ msg: 'Unable to retrieve stacks', err: err });
        });

      return deferred.promise;
    };

    service.remove = function (stack, external, endpointId) {
      var deferred = $q.defer();

      Stack.remove({ id: stack.Id ? stack.Id : stack.Name, external: external, endpointId: endpointId })
        .$promise.then(function success() {
          deferred.resolve();
        })
        .catch(function error(err) {
          deferred.reject({ msg: 'Unable to remove the stack', err: err });
        });

      return deferred.promise;
    };

    service.associate = function (stack, endpointId, orphanedRunning) {
      var deferred = $q.defer();

      if (stack.Type == 1) {
        deferred.reject({ msg: 'Unable to associate the stack', err: new Error('Docker Swarm stacks are no longer supported') });
        return deferred.promise;
      }

      Stack.associate({ id: stack.Id, endpointId: endpointId, orphanedRunning })
        .$promise.then(function success(data) {
          deferred.resolve(data);
        })
        .catch(function error(err) {
          deferred.reject({ msg: 'Unable to associate the stack', err: err });
        });

      return deferred.promise;
    };

    service.updateStack = function (stack, stackFile, env, prune, repullImageAndRedeploy) {
      return Stack.update(
        { endpointId: stack.EndpointId },
        {
          id: stack.Id,
          StackFileContent: stackFile,
          Env: env,
          Prune: prune,
          RepullImageAndRedeploy: repullImageAndRedeploy,
        }
      ).$promise;
    };

    service.createComposeStackFromFileUpload = function (name, stackFile, env, endpointId) {
      return FileUploadService.createComposeStack(name, stackFile, env, endpointId);
    };

    service.createComposeStackFromFileContent = function (name, stackFileContent, env, endpointId) {
      var payload = {
        Name: name,
        StackFileContent: stackFileContent,
        Env: env,
      };
      return Stack.create({ endpointId: endpointId }, { method: 'string', type: 'standalone', ...payload }).$promise;
    };

    service.createComposeStackFromGitRepository = function (name, repositoryOptions, env, endpointId) {
      var payload = {
        Name: name,
        RepositoryURL: repositoryOptions.RepositoryURL,
        RepositoryReferenceName: repositoryOptions.RepositoryReferenceName,
        ComposeFile: repositoryOptions.ComposeFilePathInRepository,
        AdditionalFiles: repositoryOptions.AdditionalFiles,
        RepositoryAuthentication: repositoryOptions.RepositoryAuthentication,
        RepositoryUsername: repositoryOptions.RepositoryUsername,
        RepositoryPassword: repositoryOptions.RepositoryPassword,
        Env: env,
        FromAppTemplate: repositoryOptions.FromAppTemplate,
        TLSSkipVerify: repositoryOptions.TLSSkipVerify,
      };

      if (repositoryOptions.AutoUpdate) {
        payload.AutoUpdate = repositoryOptions.AutoUpdate;
      }

      return Stack.create({ endpointId: endpointId }, { method: 'repository', type: 'standalone', ...payload }).$promise;
    };

    service.start = start;
    function start(endpointId, id) {
      return Stack.start({ id, endpointId }).$promise;
    }

    service.stop = stop;
    function stop(endpointId, id) {
      return Stack.stop({ endpointId, id }).$promise;
    }

    function updateGit(id, endpointId, env, prune, gitConfig, pullImage) {
      return Stack.updateGit(
        { endpointId, id },
        {
          env,
          prune,
          RepositoryReferenceName: gitConfig.RefName,
          RepositoryAuthentication: gitConfig.RepositoryAuthentication,
          RepositoryUsername: gitConfig.RepositoryUsername,
          RepositoryPassword: gitConfig.RepositoryPassword,
          PullImage: pullImage,
        }
      ).$promise;
    }

    service.updateGitStackSettings = function (id, endpointId, env, gitConfig, webhookId) {
      return Stack.updateGitStackSettings(
        { endpointId, id },
        {
          AutoUpdate: transformAutoUpdateViewModel(gitConfig.AutoUpdate, webhookId),
          Env: env,
          RepositoryReferenceName: gitConfig.RefName,
          RepositoryAuthentication: gitConfig.RepositoryAuthentication,
          RepositoryUsername: gitConfig.RepositoryUsername,
          RepositoryPassword: gitConfig.RepositoryPassword,
          Prune: gitConfig.Option.Prune,
          TLSSkipVerify: gitConfig.TLSSkipVerify,
        }
      ).$promise;
    };

    return service;
  },
]);
