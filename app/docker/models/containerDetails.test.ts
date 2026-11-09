import { describe, it, expect } from 'vitest';

import {
  ResourceControlOwnership,
  ResourceControlType,
} from '@/react/portainer/access-control/types';

import { ContainerDetailsViewModel } from './containerDetails';

function containerRc() {
  return {
    Id: 21,
    Type: ResourceControlType.Container,
    ResourceId: 'ctr-1',
    UserAccesses: [],
    TeamAccesses: [],
    Public: true,
    AdministratorsOnly: false,
    System: false,
  };
}

describe('REQ-CTR-04 ContainerDetailsViewModel', () => {
  it('copies inspect fields used on the container details page', () => {
    const data = {
      Id: 'abc123',
      Name: '/web',
      Created: '2024-02-01T12:00:00Z',
      Image: 'nginx:latest',
      Args: ['nginx', '-g', 'daemon off;'],
      State: { Status: 'running', Running: true },
      NetworkSettings: { Networks: { bridge: { IPAddress: '172.17.0.2' } } },
      Config: { Env: ['FOO=bar'], Labels: { app: 'web' } },
      HostConfig: { RestartPolicy: { Name: 'unless-stopped' } },
      Mounts: [{ Type: 'volume', Name: 'data', Destination: '/data' }],
      IsPortainer: false,
    };

    const vm = new ContainerDetailsViewModel(data as never);

    expect(vm.Model).toBe(data);
    expect(vm.Id).toBe('abc123');
    expect(vm.Name).toBe('/web');
    expect(vm.Created).toBe('2024-02-01T12:00:00Z');
    expect(vm.Image).toBe('nginx:latest');
    expect(vm.Args).toEqual(['nginx', '-g', 'daemon off;']);
    expect(vm.State).toEqual({ Status: 'running', Running: true });
    expect(vm.NetworkSettings.Networks.bridge.IPAddress).toBe('172.17.0.2');
    expect(vm.Config.Env).toEqual(['FOO=bar']);
    expect(vm.HostConfig.RestartPolicy.Name).toBe('unless-stopped');
    expect(vm.Mounts).toHaveLength(1);
    expect(vm.IsPortainer).toBe(false);
    expect(vm.ResourceControl).toBeUndefined();
  });

  it('builds ResourceControl when Portainer ownership is present', () => {
    const vm = new ContainerDetailsViewModel({
      Id: 'owned',
      Name: '/owned',
      Created: '',
      Image: 'busybox',
      Args: [],
      State: { Status: 'exited' },
      NetworkSettings: {},
      Config: {},
      HostConfig: {},
      Mounts: [],
      Portainer: { ResourceControl: containerRc() },
      IsPortainer: true,
    } as never);

    expect(vm.IsPortainer).toBe(true);
    expect(vm.ResourceControl?.Id).toBe(21);
    expect(vm.ResourceControl?.Type).toBe(ResourceControlType.Container);
    expect(vm.ResourceControl?.Ownership).toBe(ResourceControlOwnership.PUBLIC);
  });

  it('skips ResourceControl when Portainer has no ownership block', () => {
    const vm = new ContainerDetailsViewModel({
      Id: 'plain',
      Name: '/plain',
      Created: '',
      Image: 'busybox',
      Args: [],
      State: {},
      NetworkSettings: {},
      Config: {},
      HostConfig: {},
      Mounts: [],
      Portainer: {},
    } as never);

    expect(vm.ResourceControl).toBeUndefined();
  });
});
