import { describe, it, expect } from 'vitest';

import {
  ResourceControlOwnership,
  ResourceControlType,
} from '@/react/portainer/access-control/types';

import { VolumeViewModel } from './volume';

function volumeRc() {
  return {
    Id: 11,
    Type: ResourceControlType.Volume,
    ResourceId: 'vol-rc',
    UserAccesses: [{ UserId: 7, AccessLevel: 1 as const }],
    TeamAccesses: [],
    Public: false,
    AdministratorsOnly: false,
    System: false,
  };
}

describe('REQ-VOL-01 VolumeViewModel list mapping', () => {
  it('maps driver, mountpoint, options and labels from a local volume', () => {
    const vm = new VolumeViewModel({
      Name: 'data',
      Driver: 'local',
      Mountpoint: '/var/lib/docker/volumes/data/_data',
      Options: { device: 'tmpfs', type: 'tmpfs' },
      Labels: { env: 'dev' },
      CreatedAt: '2024-01-01T00:00:00Z',
      ResourceID: 'endpoint1_data',
    });

    expect(vm.Name).toBe('data');
    expect(vm.Id).toBe('data');
    expect(vm.Driver).toBe('local');
    expect(vm.Mountpoint).toBe('/var/lib/docker/volumes/data/_data');
    expect(vm.Options).toEqual({ device: 'tmpfs', type: 'tmpfs' });
    expect(vm.Labels).toEqual({ env: 'dev' });
    expect(vm.CreatedAt).toBe('2024-01-01T00:00:00Z');
    expect(vm.ResourceId).toBe('endpoint1_data');
    expect(vm.StackName).toBeUndefined();
    expect(vm.NodeName).toBeUndefined();
    expect(vm.ResourceControl).toBeUndefined();
  });

  it('sets StackName from a Compose project label over a Swarm stack label', () => {
    const compose = new VolumeViewModel({
      Name: 'compose-vol',
      Driver: 'local',
      Mountpoint: '/mnt',
      Labels: {
        'com.docker.compose.project': 'web',
        'com.docker.stack.namespace': 'ignored',
      },
    });
    expect(compose.StackName).toBe('web');

    const swarm = new VolumeViewModel({
      Name: 'swarm-vol',
      Driver: 'local',
      Mountpoint: '/mnt',
      Labels: { 'com.docker.stack.namespace': 'prod' },
    });
    expect(swarm.StackName).toBe('prod');
  });
});

describe('REQ-VOL-03 VolumeViewModel details mapping', () => {
  it('attaches ResourceControl and agent NodeName, and ties Id with NodeName', () => {
    const vm = new VolumeViewModel({
      Name: 'shared',
      Driver: 'local',
      Mountpoint: '/mnt/shared',
      Labels: {},
      Portainer: {
        ResourceControl: volumeRc(),
        Agent: { NodeName: 'worker-1' },
      },
    });

    expect(vm.NodeName).toBe('worker-1');
    expect(vm.Id).toBe('shared-worker-1');
    expect(vm.ResourceControl).toBeDefined();
    expect(vm.ResourceControl?.Id).toBe(11);
    expect(vm.ResourceControl?.Type).toBe(ResourceControlType.Volume);
    expect(vm.ResourceControl?.Ownership).toBe(
      ResourceControlOwnership.PRIVATE
    );
  });

  it('keeps Name as Id when NodeName is absent even with Portainer metadata', () => {
    const vm = new VolumeViewModel({
      Name: 'lonely',
      Driver: 'local',
      Mountpoint: '/mnt',
      Labels: null as unknown as Record<string, string>,
      Portainer: {},
    });
    expect(vm.Id).toBe('lonely');
    expect(vm.StackName).toBeUndefined();
    expect(vm.ResourceControl).toBeUndefined();
  });
});
