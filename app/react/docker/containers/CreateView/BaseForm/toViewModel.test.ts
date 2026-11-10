import { describe, expect, it } from 'vitest';

import { ContainerDetailsResponse } from '../../queries/useContainer';

import { getDefaultViewModel, toViewModel } from './toViewModel';

describe('REQ-CTR-06 BaseForm toViewModel when duplicating a container', () => {
  it('copies name, ports and publish flags without any ownership', () => {
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

    const result = toViewModel(config, 'node-a', image);

    expect(result.name).toBe('web');
    expect(result.autoRemove).toBe(true);
    expect(result.publishAllPorts).toBe(true);
    // REQ-TAI-014: no container webhook flag is carried over
    expect(result).not.toHaveProperty('enableWebhook');
    expect(result.nodeName).toBe('node-a');
    expect(result.image).toEqual(image);
    expect(result.alwaysPull).toBe(true);
    expect(result.ports).toEqual([
      { hostPort: '8080', containerPort: '80', protocol: 'tcp' },
    ]);
    // REQ-TAI-001: no ownership is carried into the create form
    expect(result).not.toHaveProperty('accessControl');
  });

  it('builds an empty default create form', () => {
    const result = getDefaultViewModel('');

    expect(result.name).toBe('');
    expect(result.ports).toEqual([]);
    expect(result).not.toHaveProperty('enableWebhook');
    expect(result.autoRemove).toBe(false);
    expect(result.publishAllPorts).toBe(false);
    expect(result.alwaysPull).toBe(true);
    expect(result.image.image).toBe('');
  });
});
