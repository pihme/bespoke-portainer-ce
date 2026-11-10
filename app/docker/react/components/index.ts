import angular from 'angular';

import { r2a } from '@/react-tools/react2angular';
import { withControlledInput } from '@/react-tools/withControlledInput';
import { withCurrentUser } from '@/react-tools/withCurrentUser';
import { withReactQuery } from '@/react-tools/withReactQuery';
import { withUIRouter } from '@/react-tools/withUIRouter';
import { DockerfileDetails } from '@/react/docker/images/ItemView/DockerfileDetails';
import { GpusList } from '@/react/docker/host/SetupView/GpusList';
import { AgentVolumeBrowser } from '@/react/docker/volumes/BrowseView/AgentVolumeBrowser';
import { ProcessesDatatable } from '@/react/docker/containers/StatsView/ProcessesDatatable';
import { StacksDatatable } from '@/react/docker/stacks/ListView/StacksDatatable';
import { HostDetailsPanel } from '@/react/docker/host/HostDetailsPanel/HostDetailsPanel';

import { containersModule } from './containers';
import { volumesModule } from './volumes';
import { templatesModule } from './templates';

const ngModule = angular
  .module('portainer.docker.react.components', [
    containersModule,
    volumesModule,
    templatesModule,
  ])
  .component('dockerfileDetails', r2a(DockerfileDetails, ['image']))
  .component(
    'gpusList',
    r2a(withControlledInput(GpusList), ['value', 'onChange'])
  )
  .component(
    'agentVolumeBrowserReact',
    r2a(withUIRouter(withCurrentUser(AgentVolumeBrowser)), [
      'dataset',
      'isRoot',
      'isUploadAllowed',
      'onBrowse',
      'onDelete',
      'onDownload',
      'onFileSelectedForUpload',
      'onGoToParent',
      'onRename',
      'relativePath',
    ])
  )
  .component(
    'dockerContainerProcessesDatatable',
    r2a(withUIRouter(withReactQuery(withCurrentUser(ProcessesDatatable))), [])
  )
  .component(
    'dockerStacksDatatable',
    r2a(withUIRouter(withCurrentUser(StacksDatatable)), [
      'dataset',
      'isImageNotificationEnabled',
      'onReload',
      'onRemove',
    ])
  )
  .component(
    'hostDetailsPanel',
    r2a(withUIRouter(withReactQuery(HostDetailsPanel)), ['host'])
  );
export const componentsModule = ngModule.name;
