import featureFlagModule from '@/react/portainer/feature-flags';

import componentsModule from './components';
import settingsModule from './settings';
import userActivityModule from './user-activity';
import servicesModule from './services';
import { reactModule } from './react';
import { sidebarModule } from './react/views/sidebar';
import environmentsModule from './environments';
import { helpersModule } from './helpers';
import { AccessHeaders, requiresAuthHook } from './authorization-guard';
import { filterParam, paginationParams } from './helpers/stateParamHelper';

async function initAuthentication(Authentication) {
  return await Authentication.init();
}

angular
  .module('portainer.app', [
    'portainer.registrymanagement',
    componentsModule,
    settingsModule,
    featureFlagModule,
    userActivityModule,
    servicesModule,
    reactModule,
    sidebarModule,
    environmentsModule,
    helpersModule,
  ])
  .config([
    '$stateRegistryProvider',
    function ($stateRegistryProvider) {
      var root = {
        name: 'root',
        abstract: true,
        onEnter: /* @ngInject */ function onEnter($async, StateManager, Authentication, Notifications) {
          return $async(async () => {
            const appState = StateManager.getState();
            if (!appState.loading) {
              return;
            }
            try {
              await initAuthentication(Authentication);
              await StateManager.initialize();
            } catch (err) {
              Notifications.error('Failure', err, 'Unable to retrieve application settings');
              throw err;
            }
          });
        },
        views: {
          'sidebar@': {
            component: 'sidebar',
          },
        },
        data: {
          access: AccessHeaders.Restricted,
        },
      };

      var endpointRoot = {
        name: 'endpoint',
        url: '/:endpointId',
        parent: 'root',
        abstract: true,
        resolve: {
          endpoint: /* @ngInject */ function endpoint($async, $state, $transition$, EndpointProvider, EndpointService, Notifications) {
            return $async(async () => {
              try {
                const endpointId = +$transition$.params().endpointId;

                const endpoint = await EndpointService.endpoint(endpointId);
                EndpointProvider.setCurrentEndpoint(endpoint);

                return endpoint;
              } catch (e) {
                Notifications.error('Failed loading environment', e);
                $state.go('portainer.home', {}, { reload: true });
                return;
              }
            });
          },
        },
      };

      var portainer = {
        name: 'portainer',
        parent: 'root',
        abstract: true,
      };

      var account = {
        name: 'portainer.account',
        url: '/account',
        views: {
          'content@': {
            templateUrl: './views/account/account.html',
          },
        },
        data: {
          docs: '/user/account-settings',
        },
      };

      var endpoints = {
        name: 'portainer.endpoints',
        url: '/endpoints',
        views: {
          'content@': {
            component: 'environmentsListView',
          },
        },
        data: {
          docs: '/admin/environments/environments',
        },
      };

      var endpoint = {
        name: 'portainer.endpoints.endpoint',
        url: '/:id?redirectTo',
        params: {
          redirectTo: '',
        },
        views: {
          'content@': {
            component: 'environmentsItemView',
          },
        },
      };

      var groups = {
        name: 'portainer.groups',
        url: '/groups',
        views: {
          'content@': {
            component: 'environmentGroupsListView',
          },
        },
        data: {
          docs: '/admin/environments/groups',
          access: AccessHeaders.Admin,
        },
      };

      var group = {
        name: 'portainer.groups.group',
        url: '/:id?tab',
        views: {
          'content@': {
            component: 'environmentGroupEditView',
          },
        },
        params: {
          id: {
            type: 'int',
          },
          tab: {
            dynamic: true,
          },
        },
      };

      var groupCreation = {
        name: 'portainer.groups.new',
        url: '/new',
        views: {
          'content@': {
            component: 'environmentGroupCreateView',
          },
        },
      };

      var home = {
        name: 'portainer.home',
        url: '/home?redirect&environmentId&environmentName&route&groupBy&groupFilter&search&order',
        params: {
          ...paginationParams(),
          sort: filterParam(),
          order: filterParam(),
          groupBy: filterParam(),
          groupFilter: filterParam(),
        },
        views: {
          'content@': {
            component: 'homeView',
          },
        },
        data: {
          docs: '/user/home',
        },
      };

      var gitopsBase = {
        name: 'portainer.gitops',
        url: '/gitops',
        abstract: true,
      };

      var workflows = {
        name: 'portainer.gitops.workflows',
        url: '/workflows?search&sort&order&page&pageSize&status&type&platform&groupBy&groupFilter',
        data: { docs: '/user/app-delivery/workflows' },
        params: {
          ...paginationParams(),
          sort: filterParam(),
          order: filterParam(),
          status: filterParam(),
          type: filterParam(),
          platform: filterParam(),
          groupBy: filterParam(),
          groupFilter: filterParam(),
        },
        views: {
          'content@': {
            component: 'workflowsView',
          },
        },
      };

      var gitopsWorkflowDetail = {
        name: 'portainer.gitops.workflows.item',
        url: '/:workflowId',
        views: {
          'content@': {
            component: 'workflowItemView',
          },
        },
      };

      var gitopsSources = {
        name: 'portainer.gitops.sources',
        url: '/sources?search&sort&order&page&pageSize&status&type',
        data: { docs: '/user/app-delivery/sources' },
        params: {
          ...paginationParams(),
          sort: filterParam(),
          order: filterParam(),
          status: filterParam(),
          type: filterParam(),
        },
        views: {
          'content@': {
            component: 'sourcesListView',
          },
        },
      };

      var gitopsSourceDetail = {
        name: 'portainer.gitops.sources.item',
        url: '/:sourceId?tab',
        params: {
          tab: filterParam('settings'),
        },
        views: {
          'content@': {
            component: 'sourceItemView',
          },
        },
      };

      const gitopsSourceCreate = {
        name: 'portainer.gitops.sources.new',
        url: '/new',
        views: {
          'content@': {
            component: 'sourceCreateView',
          },
        },
      };

      var init = {
        name: 'portainer.init',
        abstract: true,
        url: '/init',
        views: {
          'sidebar@': {},
        },
        data: {
          access: undefined,
        },
      };

      var settings = {
        name: 'portainer.settings',
        url: '/settings',
        views: {
          'content@': {
            component: 'settingsView',
          },
        },
        data: {
          docs: '/admin/settings',
          access: AccessHeaders.Admin,
        },
      };

      var tags = {
        name: 'portainer.tags',
        url: '/tags',
        views: {
          'content@': {
            templateUrl: './views/tags/tags.html',
            controller: 'TagsController',
          },
        },
        data: {
          docs: '/admin/environments/tags',
          access: AccessHeaders.Admin,
        },
      };

      $stateRegistryProvider.register(root);
      $stateRegistryProvider.register(endpointRoot);
      $stateRegistryProvider.register(portainer);
      $stateRegistryProvider.register(account);
      $stateRegistryProvider.register(endpoints);
      $stateRegistryProvider.register(endpoint);
      $stateRegistryProvider.register(groups);
      $stateRegistryProvider.register(group);
      $stateRegistryProvider.register(groupCreation);
      $stateRegistryProvider.register(home);
      $stateRegistryProvider.register(gitopsBase);
      $stateRegistryProvider.register(workflows);
      $stateRegistryProvider.register(gitopsWorkflowDetail);
      $stateRegistryProvider.register(gitopsSources);
      $stateRegistryProvider.register(gitopsSourceDetail);
      $stateRegistryProvider.register(gitopsSourceCreate);
      $stateRegistryProvider.register(init);
      $stateRegistryProvider.register(settings);
      $stateRegistryProvider.register(tags);
    },
  ])
  .run(run);

/* @ngInject */
function run($transitions) {
  requiresAuthHook($transitions);
}
