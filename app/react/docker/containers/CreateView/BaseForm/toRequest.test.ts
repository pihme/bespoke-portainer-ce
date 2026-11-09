import { describe, expect, it } from 'vitest';

import { CreateContainerRequest } from '../types';

import { Values } from './BaseForm';
import { toRequest } from './toRequest';

describe('REQ-CTR-03 BaseForm toRequest for ports and publish flags', () => {
  const oldConfig: CreateContainerRequest = {
    HostConfig: {},
    NetworkingConfig: {},
  };

  const baseValues: Values = {
    name: 'web',
    enableWebhook: false,
    publishAllPorts: true,
    image: { image: 'nginx', registryId: 0, useRegistry: true },
    alwaysPull: true,
    ports: [{ containerPort: '80', hostPort: '8080', protocol: 'tcp' }],
    accessControl: {
      ownership: 'administrators',
      authorizedUsers: [],
      authorizedTeams: [],
    },
    nodeName: '',
    autoRemove: true,
  };

  it('exposes ports and sets HostConfig publish/autoRemove flags', () => {
    const result = toRequest(oldConfig, baseValues);

    expect(result.ExposedPorts).toEqual({ '80/tcp': {} });
    expect(result.HostConfig.PublishAllPorts).toBe(true);
    expect(result.HostConfig.AutoRemove).toBe(true);
    expect(result.HostConfig.PortBindings).toEqual({
      '80/tcp': [{ HostIp: '', HostPort: '8080' }],
    });
  });
});
