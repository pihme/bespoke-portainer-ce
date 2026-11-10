import angular from 'angular';

import { HomeView } from '@/react/portainer/HomeView';
import { withCurrentUser } from '@/react-tools/withCurrentUser';
import { r2a } from '@/react-tools/react2angular';
import { withReactQuery } from '@/react-tools/withReactQuery';
import { withUIRouter } from '@/react-tools/withUIRouter';
import { SettingsView } from '@/react/portainer/settings/SettingsView/SettingsView';

import { wizardModule } from './wizard';
import { environmentGroupModule } from './env-groups';
import { activityLogsModule } from './activity-logs';
import { templatesModule } from './templates';
import { environmentsModule } from './environments';
import { gitopsViewsModule } from './gitops';

export const viewsModule = angular
  .module('portainer.app.react.views', [
    wizardModule,
    environmentGroupModule,
    activityLogsModule,
    templatesModule,
    environmentsModule,
    gitopsViewsModule,
  ])
  .component(
    'homeView',
    r2a(withUIRouter(withReactQuery(withCurrentUser(HomeView))), [])
  )
  .component(
    'settingsView',
    r2a(withUIRouter(withReactQuery(withCurrentUser(SettingsView))), [])
  ).name;
