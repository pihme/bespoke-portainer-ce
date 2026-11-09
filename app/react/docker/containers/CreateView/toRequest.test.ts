import { describe, expect, it } from 'vitest';

import { ResourceControlOwnership } from '@/react/portainer/access-control/types';

import { RestartPolicy } from './RestartPolicyTab/types';
import { toRequest } from './toRequest';
import { Values } from './useInitialValues';

function buildValues(overrides: Partial<Values> = {}): Values {
  return {
    name: 'web',
    enableWebhook: false,
    publishAllPorts: false,
    image: { image: 'nginx', registryId: 0, useRegistry: false },
    alwaysPull: true,
    ports: [{ containerPort: '80', hostPort: '8080', protocol: 'tcp' }],
    accessControl: {
      ownership: ResourceControlOwnership.ADMINISTRATORS,
      authorizedUsers: [],
      authorizedTeams: [],
    },
    nodeName: '',
    autoRemove: false,
    commands: {
      cmd: 'nginx -g daemon-off',
      entrypoint: null,
      user: '',
      workingDir: '',
      console: 'none',
      logConfig: { type: '', options: [] },
    },
    volumes: [
      {
        type: 'volume',
        name: 'data',
        containerPath: '/data',
        readOnly: false,
      },
    ],
    network: {
      networkMode: 'bridge',
      hostname: 'web',
      domain: '',
      macAddress: '',
      ipv4Address: '',
      ipv6Address: '',
      primaryDns: '8.8.8.8',
      secondaryDns: '',
      hostsFileEntries: [],
      container: '',
    },
    labels: [{ name: 'app', value: 'web' }],
    restartPolicy: RestartPolicy.UnlessStopped,
    resources: {
      runtime: { privileged: false, init: false, type: '' },
      devices: [],
      sysctls: [],
      securityOpt: [],
      sharedMemorySize: 64,
      gpu: {
        enabled: false,
        useSpecific: false,
        selectedGPUs: ['all'],
        capabilities: ['compute', 'utility'],
      },
      resources: { reservation: 0, limit: 0, cpu: 0 },
    },
    capabilities: ['CHOWN'],
    env: [{ name: 'FOO', value: 'bar' }],
    ...overrides,
  };
}

describe('REQ-CTR-03 CreateView toRequest for local Docker create', () => {
  it('aggregates tab values into a create container request', () => {
    const result = toRequest(buildValues(), undefined, false);

    expect(result.Image).toBe('nginx:latest');
    expect(result.Hostname).toBe('web');
    expect(result.HostConfig.NetworkMode).toBe('bridge');
    expect(result.HostConfig.Dns).toEqual(['8.8.8.8']);
    expect(result.HostConfig.RestartPolicy?.Name).toBe(
      RestartPolicy.UnlessStopped
    );
    expect(result.HostConfig.Binds).toEqual(['data:/data']);
    expect(result.HostConfig.PortBindings).toEqual({
      '80/tcp': [{ HostIp: '', HostPort: '8080' }],
    });
    expect(result.Labels).toEqual({ app: 'web' });
    expect(result.Env).toEqual(['FOO=bar']);
    expect(result.Cmd).toEqual(['nginx', '-g', 'daemon-off']);
    expect(result.HostConfig.CapAdd).toEqual(['CHOWN']);
    expect(result.HostConfig.CapDrop?.length).toBeGreaterThan(0);
  });

  it('ignores capabilities when ignoreCapabilities is set', () => {
    const result = toRequest(buildValues(), undefined, true);

    expect(result.HostConfig.CapAdd).toEqual([]);
    expect(result.HostConfig.CapDrop).toEqual([]);
  });
});
