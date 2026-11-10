import angular from 'angular';

import { NotificationsViewAngular } from '@/react/portainer/notifications/NotificationsView';

export default angular
  .module('portainer.app.user-activity', [])
  .component('notifications', NotificationsViewAngular)
  .config(config).name;

/* @ngInject */
function config($stateRegistryProvider) {
  $stateRegistryProvider.register({
    name: 'portainer.notifications',
    url: '/notifications',
    views: {
      'content@': {
        component: 'notifications',
      },
    },
    params: {
      id: '',
    },
    data: {
      docs: '/admin/notifications',
    },
  });
}
