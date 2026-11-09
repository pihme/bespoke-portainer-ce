import { describe, expect, it } from 'vitest';

import { ResourceControlOwnership } from '@/react/portainer/access-control/types';

import { ContainerDetailsResponse } from '../../queries/useContainer';

import { getDefaultViewModel, toViewModel } from './toViewModel';

describe('REQ-CTR-06 BaseForm toViewModel when duplicating a container', () => {
  it('copies name, ports and publish flags and clears ownership to defaults', () => {
    const config = {
      Name: '/web',
      HostConfig: {
        AutoRemove: true,
        PublishAllPorts: true,
        PortBindings: {
          '80/tcp': [{ HostIp: '', HostPort: '8080' }],
        },
      },
      Portainer: {
        ResourceControl: {
          Public: true,
        },
      },
    } as unknown as ContainerDetailsResponse;

    const image = {
      image: 'nginx:latest',
      registryId: 1,
      useRegistry: true,
    };

    const result = toViewModel(config, false, 7, 'node-a', image, true);

    expect(result.name).toBe('web');
    expect(result.autoRemove).toBe(true);
    expect(result.publishAllPorts).toBe(true);
    expect(result.enableWebhook).toBe(true);
    expect(result.nodeName).toBe('node-a');
    expect(result.image).toEqual(image);
    expect(result.alwaysPull).toBe(true);
    expect(result.ports).toEqual([
      { hostPort: '8080', containerPort: '80', protocol: 'tcp' },
    ]);
    expect(result.accessControl.ownership).toBe(
      ResourceControlOwnership.PUBLIC
    );
  });

  it('builds an empty default create form', () => {
    const result = getDefaultViewModel(true, 1, '');

    expect(result.name).toBe('');
    expect(result.ports).toEqual([]);
    expect(result.enableWebhook).toBe(false);
    expect(result.autoRemove).toBe(false);
    expect(result.publishAllPorts).toBe(false);
    expect(result.alwaysPull).toBe(true);
    expect(result.image.image).toBe('');
  });
});
