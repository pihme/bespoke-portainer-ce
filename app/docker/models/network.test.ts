import { describe, it, expect } from 'vitest';

import {
  ResourceControlOwnership,
  ResourceControlType,
} from '@/react/portainer/access-control/types';

import { NetworkViewModel } from './network';

function networkRc() {
  return {
    Id: 31,
    Type: ResourceControlType.Network,
    ResourceId: 'net-1',
    UserAccesses: [
      { UserId: 1, AccessLevel: 1 as const },
      { UserId: 2, AccessLevel: 1 as const },
    ],
    TeamAccesses: [],
    Public: false,
    AdministratorsOnly: false,
    System: false,
  };
}

describe('REQ-NET-01 NetworkViewModel list mapping', () => {
  it('maps core network fields and stack labels for the networks list', () => {
    const vm = new NetworkViewModel({
      Id: 'bridge-id',
      Name: 'bridge',
      Scope: 'local',
      Driver: 'bridge',
      Attachable: false,
      Internal: false,
      Ingress: false,
      IPAM: { Driver: 'default', Config: [{ Subnet: '172.17.0.0/16' }] },
      Containers: {
        c1: { Name: 'web', EndpointID: 'ep1', IPv4Address: '172.17.0.2/16' },
      },
      Options: { 'com.docker.network.bridge.name': 'docker0' },
      Labels: { 'com.docker.compose.project': 'demo' },
    } as never);

    expect(vm.Id).toBe('bridge-id');
    expect(vm.Name).toBe('bridge');
    expect(vm.Scope).toBe('local');
    expect(vm.Driver).toBe('bridge');
    expect(vm.Attachable).toBe(false);
    expect(vm.Internal).toBe(false);
    expect(vm.Ingress).toBe(false);
    expect(vm.IPAM?.Driver).toBe('default');
    expect(vm.Containers?.c1.Name).toBe('web');
    expect(vm.Options?.['com.docker.network.bridge.name']).toBe('docker0');
    expect(vm.StackName).toBe('demo');
    expect(vm.NodeName).toBeUndefined();
    expect(vm.ResourceControl).toBeUndefined();
  });

  it('prefers Compose project labels and falls back to Swarm stack namespace', () => {
    const swarm = new NetworkViewModel({
      Id: 'overlay-1',
      Name: 'overlay',
      Labels: { 'com.docker.stack.namespace': 'stack-a' },
    } as never);
    expect(swarm.StackName).toBe('stack-a');
  });

  it('defaults missing optional fields to empty values', () => {
    const vm = new NetworkViewModel({} as never);
    expect(vm.Id).toBe('');
    expect(vm.Name).toBe('');
    expect(vm.Scope).toBe('');
    expect(vm.Driver).toBe('');
    expect(vm.Attachable).toBe(false);
    expect(vm.Internal).toBe(false);
    expect(vm.Ingress).toBe(false);
    expect(vm.Labels).toEqual({});
    expect(vm.StackName).toBeUndefined();
  });
});

describe('REQ-NET-03 NetworkViewModel details mapping', () => {
  it('attaches ResourceControl, agent NodeName and macvlan config fields', () => {
    const vm = new NetworkViewModel({
      Id: 'macvlan-1',
      Name: 'macvlan',
      Driver: 'macvlan',
      Labels: {},
      ConfigFrom: { Network: 'parent-net' },
      ConfigOnly: true,
      Portainer: {
        ResourceControl: networkRc(),
        Agent: { NodeName: 'edge-node' },
      },
    } as never);

    expect(vm.ConfigFrom).toEqual({ Network: 'parent-net' });
    expect(vm.ConfigOnly).toBe(true);
    expect(vm.NodeName).toBe('edge-node');
    expect(vm.ResourceControl?.Id).toBe(31);
    expect(vm.ResourceControl?.Type).toBe(ResourceControlType.Network);
    expect(vm.ResourceControl?.Ownership).toBe(
      ResourceControlOwnership.RESTRICTED
    );
  });

  it('ignores Portainer metadata without ResourceControl or Agent NodeName', () => {
    const vm = new NetworkViewModel({
      Id: 'n1',
      Name: 'n1',
      Labels: {},
      Portainer: { Agent: {} },
    } as never);

    expect(vm.NodeName).toBeUndefined();
    expect(vm.ResourceControl).toBeUndefined();
  });
});
