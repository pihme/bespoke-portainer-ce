import angular from 'angular';

import { PortainerEndpointTypes } from '@/portainer/models/endpoint/models';

import { EnvironmentStatus } from '@/react/portainer/environments/types';

import { reactModule } from './react';

angular.module('portainer.docker', ['portainer.app', reactModule]).config([
  '$stateRegistryProvider',
  function ($stateRegistryProvider) {
    'use strict';

    var docker = {
      name: 'docker',
      parent: 'endpoint',
      url: '/docker',
      abstract: true,
      onEnter: /* @ngInject */ function onEnter(endpoint, $async, $state, EndpointService, Notifications, StateManager, SystemService, EndpointProvider) {
        return $async(async () => {
          const dockerTypes = [PortainerEndpointTypes.DockerEnvironment, PortainerEndpointTypes.AgentOnDockerEnvironment, PortainerEndpointTypes.EdgeAgentOnDockerEnvironment];

          if (!dockerTypes.includes(endpoint.Type)) {
            $state.go('portainer.home');
            return;
          }

          try {
            const { status, error } = await checkEndpointStatus(endpoint);

            if (endpoint.Type !== PortainerEndpointTypes.EdgeAgentOnDockerEnvironment) {
              await updateEndpointStatus(endpoint, status);
            }
            endpoint.Status = status;

            if (status === EnvironmentStatus.Down) {
              throw error || new Error(`The environment named ${endpoint.Name} is unreachable.`);
            }

            await StateManager.updateEndpointState(endpoint);
          } catch (e) {
            let params = {};

            if (endpoint.Type == PortainerEndpointTypes.EdgeAgentOnDockerEnvironment) {
              params = { redirect: true, environmentId: endpoint.Id, environmentName: endpoint.Name, route: 'docker.dashboard' };
            } else {
              EndpointProvider.clean();
              Notifications.error('Failed loading environment', e);
            }
            $state.go('portainer.home', params, { reload: true, inherit: false });
            return false;
          }

          async function checkEndpointStatus(endpoint) {
            try {
              await SystemService.ping(endpoint.Id);
              return { status: EnvironmentStatus.Up };
            } catch (e) {
              return { status: EnvironmentStatus.Down, error: e };
            }
          }

          async function updateEndpointStatus(endpoint, status) {
            if (endpoint.Status === status) {
              return;
            }
            await EndpointService.updateEndpoint(endpoint.Id, { Status: status });
          }
        });
      },
    };

    const customTemplates = {
      name: 'docker.templates.custom',
      url: '/custom',

      views: {
        'content@': {
          component: 'customTemplatesView',
        },
      },
      data: {
        docs: '/user/docker/templates/custom',
      },
    };

    const customTemplatesNew = {
      name: 'docker.templates.custom.new',
      url: '/new?fileContent&appTemplateId&type',

      views: {
        'content@': {
          component: 'createCustomTemplatesView',
        },
      },
    };

    const customTemplatesEdit = {
      name: 'docker.templates.custom.edit',
      url: '/:id',

      views: {
        'content@': {
          component: 'editCustomTemplatesView',
        },
      },
    };

    var dashboard = {
      name: 'docker.dashboard',
      url: '/dashboard',
      views: {
        'content@': {
          component: 'dockerDashboardView',
        },
      },
      data: {
        docs: '/user/docker/dashboard',
      },
    };

    var host = {
      name: 'docker.host',
      url: '/host',
      views: {
        'content@': {
          component: 'hostView',
        },
      },
      data: {
        docs: '/user/docker/host/details',
      },
    };

    var hostBrowser = {
      name: 'docker.host.browser',
      url: '/browser',
      views: {
        'content@': {
          component: 'hostBrowserView',
        },
      },
    };

    var events = {
      name: 'docker.events',
      url: '/events',
      views: {
        'content@': {
          component: 'eventsListView',
        },
      },
      data: {
        docs: '/user/docker/events',
      },
    };

    var images = {
      name: 'docker.images',
      url: '/images',
      views: {
        'content@': {
          component: 'imagesListView',
        },
      },
      data: {
        docs: '/user/docker/images',
      },
    };

    var image = {
      name: 'docker.images.image',
      url: '/:id?nodeName',
      views: {
        'content@': {
          templateUrl: './views/images/edit/image.html',
          controller: 'ImageController',
        },
      },
    };

    var imageBuild = {
      name: 'docker.images.build',
      url: '/build',
      views: {
        'content@': {
          templateUrl: './views/images/build/buildimage.html',
          controller: 'BuildImageController',
        },
      },
      data: {
        docs: '/user/docker/images/build',
      },
    };

    var imageImport = {
      name: 'docker.images.import',
      url: '/import',
      views: {
        'content@': {
          templateUrl: './views/images/import/importimage.html',
          controller: 'ImportImageController',
        },
      },
      data: {
        docs: '/user/docker/images/import',
      },
    };

    var networks = {
      name: 'docker.networks',
      url: '/networks',
      views: {
        'content@': {
          component: 'networksListView',
        },
      },
      data: {
        docs: '/user/docker/networks',
      },
    };

    var network = {
      name: 'docker.networks.network',
      url: '/:id?nodeName',
      views: {
        'content@': {
          component: 'networkDetailsView',
        },
      },
    };

    var networkCreation = {
      name: 'docker.networks.new',
      url: '/new',
      views: {
        'content@': {
          templateUrl: './views/networks/create/createnetwork.html',
          controller: 'CreateNetworkController',
        },
      },
      data: {
        docs: '/user/docker/networks/add',
      },
    };

    var stacks = {
      name: 'docker.stacks',
      url: '/stacks',
      views: {
        'content@': {
          templateUrl: '~@/portainer/views/stacks/stacks.html',
          controller: 'StacksController',
        },
      },
      data: {
        docs: '/user/docker/stacks',
      },
    };

    var stack = {
      name: 'docker.stacks.stack',
      url: '/:name?id&type&regular&external&orphaned&orphanedRunning&tab',
      views: {
        'content@': {
          component: 'stackItemView',
        },
      },
    };

    var stackContainer = {
      name: 'docker.stacks.stack.container',
      url: '/:id?nodeName',
      views: {
        'content@': {
          component: 'containerItemView',
        },
      },
    };

    var stackCreation = {
      name: 'docker.stacks.newstack',
      url: '/newstack',
      views: {
        'content@': {
          component: 'createStackView',
        },
      },
    };

    var templates = {
      name: 'docker.templates',
      url: '/templates?template',
      views: {
        'content@': {
          component: 'appTemplatesView',
        },
      },
      data: {
        docs: '/user/docker/templates/application',
      },
    };

    var volumes = {
      name: 'docker.volumes',
      url: '/volumes',
      views: {
        'content@': {
          templateUrl: './views/volumes/volumes.html',
          controller: 'VolumesController',
        },
      },
      data: {
        docs: '/user/docker/volumes',
      },
    };

    var volume = {
      name: 'docker.volumes.volume',
      url: '/:id?nodeName',
      views: {
        'content@': {
          templateUrl: './views/volumes/edit/volume.html',
          controller: 'VolumeController',
        },
      },
    };

    var volumeBrowse = {
      name: 'docker.volumes.volume.browse',
      url: '/browse',
      views: {
        'content@': {
          templateUrl: './views/volumes/browse/browsevolume.html',
          controller: 'BrowseVolumeController',
        },
      },
    };

    var volumeCreation = {
      name: 'docker.volumes.new',
      url: '/new',
      views: {
        'content@': {
          templateUrl: './views/volumes/create/createvolume.html',
          controller: 'CreateVolumeController',
        },
      },
      data: {
        docs: '/user/docker/volumes/add',
      },
    };

    const dockerFeaturesConfiguration = {
      name: 'docker.host.featuresConfiguration',
      url: '/feat-config',
      views: {
        'content@': {
          component: 'dockerFeaturesConfigurationView',
        },
      },
      data: {
        docs: '/user/docker/host/setup',
      },
    };

    const dockerRegistries = {
      name: 'docker.host.registries',
      url: '/registries',
      views: {
        'content@': {
          component: 'environmentRegistriesView',
        },
      },
      data: {
        docs: '/user/docker/host/registries',
      },
    };


    $stateRegistryProvider.register(customTemplates);
    $stateRegistryProvider.register(customTemplatesNew);
    $stateRegistryProvider.register(customTemplatesEdit);
    $stateRegistryProvider.register(docker);
    $stateRegistryProvider.register(dashboard);
    $stateRegistryProvider.register(host);
    $stateRegistryProvider.register(hostBrowser);
    $stateRegistryProvider.register(events);
    $stateRegistryProvider.register(images);
    $stateRegistryProvider.register(image);
    $stateRegistryProvider.register(imageBuild);
    $stateRegistryProvider.register(imageImport);
    $stateRegistryProvider.register(networks);
    $stateRegistryProvider.register(network);
    $stateRegistryProvider.register(networkCreation);
    $stateRegistryProvider.register(stacks);
    $stateRegistryProvider.register(stack);
    $stateRegistryProvider.register(stackContainer);
    $stateRegistryProvider.register(stackCreation);
    $stateRegistryProvider.register(templates);
    $stateRegistryProvider.register(volumes);
    $stateRegistryProvider.register(volume);
    $stateRegistryProvider.register(volumeBrowse);
    $stateRegistryProvider.register(volumeCreation);
    $stateRegistryProvider.register(dockerFeaturesConfiguration);
    $stateRegistryProvider.register(dockerRegistries);
  },
]);
