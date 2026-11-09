import { describe, expect, it } from 'vitest';

import {
  ContainerEngine,
  EnvironmentStatus,
  EnvironmentType,
} from '../types';

import { buildUrl, toEnvironment } from './utils';

function baseEndpoint(overrides: Record<string, unknown> = {}) {
  return {
    Id: 1,
    Name: 'local',
    Type: EnvironmentType.Docker,
    Status: EnvironmentStatus.Up,
    ContainerEngine: ContainerEngine.Docker,
    TagIds: [1, 2],
    Gpus: [{ name: 'gpu0', value: '0' }],
    EnableGPUManagement: true,
    Snapshots: [{ GpuUseList: undefined }],
    Agent: { Version: '2.0.0' },
    Edge: undefined,
    Kubernetes: {
      Configuration: {
        StorageClasses: [{ AccessModes: undefined }],
        IngressClasses: undefined,
      },
    },
    ...overrides,
  } as never;
}

describe('environment.service utils (backwards compatibility)', () => {
  it('buildUrl composes endpoints paths with optional id and action', () => {
    expect(buildUrl()).toBe('endpoints');
    expect(buildUrl(3)).toBe('endpoints/3');
    expect(buildUrl(3, 'settings')).toBe('endpoints/3/settings');
    expect(buildUrl(undefined, 'summary')).toBe('endpoints/summary');
  });

  it('toEnvironment fills Docker defaults and maps nested snapshot/edge/k8s fields', () => {
    const env = toEnvironment(
      baseEndpoint({
        Type: undefined,
        Status: undefined,
        ContainerEngine: '',
        TagIds: undefined,
        Gpus: undefined,
        EnableGPUManagement: undefined,
        Snapshots: undefined,
        Agent: undefined,
      })
    );

    expect(env.Type).toBe(EnvironmentType.Docker);
    expect(env.Status).toBe(EnvironmentStatus.Down);
    expect(env.ContainerEngine).toBe(ContainerEngine.Kubernetes);
    expect(env.TagIds).toEqual([]);
    expect(env.Gpus).toEqual([]);
    expect(env.EnableGPUManagement).toBe(false);
    expect(env.Snapshots).toEqual([]);
    expect(env.Agent).toEqual({ Version: '', IsOutdated: false });
    expect(env.Edge).toEqual({
      AsyncMode: false,
      PingInterval: 0,
      SnapshotInterval: 0,
      CommandInterval: 0,
    });
    expect(env.Kubernetes.Configuration.StorageClasses[0].AccessModes).toEqual(
      []
    );
    expect(env.Kubernetes.Configuration.IngressClasses).toEqual([]);
    expect(env.ChangeWindow.Enabled).toBe(false);
    expect(env.EnableImageNotification).toBe(false);
  });

  it('toEnvironment maps docker and podman container engines and edge intervals', () => {
    const docker = toEnvironment(baseEndpoint({ ContainerEngine: 'docker' }));
    expect(docker.ContainerEngine).toBe(ContainerEngine.Docker);

    const podman = toEnvironment(baseEndpoint({ ContainerEngine: 'podman' }));
    expect(podman.ContainerEngine).toBe(ContainerEngine.Podman);

    const unknown = toEnvironment(baseEndpoint({ ContainerEngine: 'other' }));
    expect(unknown.ContainerEngine).toBe(ContainerEngine.Docker);

    const withEdge = toEnvironment(
      baseEndpoint({
        Edge: {
          AsyncMode: true,
          PingInterval: 1,
          SnapshotInterval: 2,
          CommandInterval: 3,
        },
        Snapshots: [{ GpuUseList: ['gpu0'] }],
        Kubernetes: {
          Configuration: {
            StorageClasses: [{ Name: 'std', AccessModes: ['RWO'] }],
            IngressClasses: [{ Name: 'nginx' }],
          },
        },
      })
    );
    expect(withEdge.Edge.AsyncMode).toBe(true);
    expect(withEdge.Edge.PingInterval).toBe(1);
    expect(withEdge.Snapshots[0].GpuUseList).toEqual(['gpu0']);
    expect(withEdge.Kubernetes.Configuration.StorageClasses[0].AccessModes).toEqual([
      'RWO',
    ]);
  });
});
