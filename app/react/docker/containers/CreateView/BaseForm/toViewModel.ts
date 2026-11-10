import { getDefaultImageConfig } from '@@/ImageConfigFieldset/getImageConfig';

import { ContainerDetailsResponse } from '../../queries/useContainer';

import { toViewModel as toPortsMappingViewModel } from './PortsMappingField.viewModel';
import { Values } from './BaseForm';

export function toViewModel(
  config: ContainerDetailsResponse,
  nodeName: string,
  image: Values['image']
): Values {
  return {
    name: config.Name ? config.Name.replace('/', '') : '',
    alwaysPull: true,
    autoRemove: config.HostConfig?.AutoRemove || false,
    ports: toPortsMappingViewModel(config.HostConfig?.PortBindings || {}),
    publishAllPorts: config.HostConfig?.PublishAllPorts || false,
    nodeName,
    image,
  };
}

export function getDefaultViewModel(nodeName: string): Values {
  return {
    nodeName,
    image: getDefaultImageConfig(),
    name: '',
    alwaysPull: true,
    autoRemove: false,
    ports: [],
    publishAllPorts: false,
  };
}
