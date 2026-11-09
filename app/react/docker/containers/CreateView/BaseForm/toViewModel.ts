import { getDefaultImageConfig } from '@@/ImageConfigFieldset/getImageConfig';

import { ContainerDetailsResponse } from '../../queries/useContainer';

import { toViewModel as toPortsMappingViewModel } from './PortsMappingField.viewModel';
import { Values } from './BaseForm';

export function toViewModel(
  config: ContainerDetailsResponse,
  nodeName: string,
  image: Values['image'],
  enableWebhook: boolean
): Values {
  return {
    name: config.Name ? config.Name.replace('/', '') : '',
    alwaysPull: true,
    autoRemove: config.HostConfig?.AutoRemove || false,
    ports: toPortsMappingViewModel(config.HostConfig?.PortBindings || {}),
    publishAllPorts: config.HostConfig?.PublishAllPorts || false,
    nodeName,
    image,
    enableWebhook,
  };
}

export function getDefaultViewModel(nodeName: string): Values {
  return {
    nodeName,
    enableWebhook: false,
    image: getDefaultImageConfig(),
    name: '',
    alwaysPull: true,
    autoRemove: false,
    ports: [],
    publishAllPorts: false,
  };
}
