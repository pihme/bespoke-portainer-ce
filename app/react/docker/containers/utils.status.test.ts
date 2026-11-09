import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';

import { toListViewModel, useShowGPUsColumn } from './utils';
import { ContainerStatus } from './types';
import { DockerContainerResponse } from './types/response';

vi.mock('@/react/docker/proxy/queries/useInfo', () => ({
  useIsStandalone: vi.fn(),
}));

import { useIsStandalone } from '@/react/docker/proxy/queries/useInfo';

function createMockResponse(
  overrides: Partial<DockerContainerResponse> = {}
): DockerContainerResponse {
  return {
    Id: 'container123',
    Names: ['/test-container'],
    Image: 'nginx:latest',
    ImageID: 'sha256:abc123',
    Command: 'nginx -g daemon off;',
    Created: 1234567890,
    State: 'running',
    Status: 'Up 2 hours',
    Ports: [],
    Labels: {},
    SizeRw: 0,
    SizeRootFs: 0,
    HostConfig: { NetworkMode: 'bridge' },
    NetworkSettings: { Networks: {} },
    Mounts: [],
    ...overrides,
  };
}

describe('REQ-CTR-01 toListViewModel status mapping', () => {
  it('maps health text and standardized State values to ContainerStatus', () => {
    expect(toListViewModel(createMockResponse({ Status: 'Up (healthy)' })).Status).toBe(
      ContainerStatus.Healthy
    );
    expect(
      toListViewModel(createMockResponse({ Status: 'Up (unhealthy)' })).Status
    ).toBe(ContainerStatus.Unhealthy);
    expect(
      toListViewModel(
        createMockResponse({ Status: 'Up (health: starting)' })
      ).Status
    ).toBe(ContainerStatus.Starting);

    const cases: Array<[string, ContainerStatus]> = [
      ['paused', ContainerStatus.Paused],
      ['dead', ContainerStatus.Dead],
      ['created', ContainerStatus.Created],
      ['exited', ContainerStatus.Exited],
      ['restarting', ContainerStatus.Restarting],
      ['removing', ContainerStatus.Removing],
      ['running', ContainerStatus.Running],
      ['unknown', ContainerStatus.Running],
    ];
    for (const [state, expected] of cases) {
      expect(
        toListViewModel(createMockResponse({ State: state, Status: '' })).Status
      ).toBe(expected);
    }
  });

  it('reads compose/swarm stack labels, IP, ports without public, and empty Portainer', () => {
    const withSwarm = toListViewModel(
      createMockResponse({
        Labels: { 'com.docker.stack.namespace': 'swarm-stack' },
        Ports: [{ PrivatePort: 80, Type: 'tcp' } as never],
        NetworkSettings: { Networks: {} },
        Portainer: undefined,
      })
    );
    expect(withSwarm.StackName).toBe('swarm-stack');
    expect(withSwarm.Ports).toEqual([]);
    expect(withSwarm.IP).toBe('');
    expect(withSwarm.NodeName).toBe('');
    expect(withSwarm.ResourceControl).toBeUndefined();
  });
});

describe('useShowGPUsColumn for local Docker', () => {
  it('is true only for standalone environments with GPU management enabled', () => {
    const mocked = vi.mocked(useIsStandalone);

    mocked.mockReturnValue(true);
    const { result: r1 } = renderHook(() =>
      useShowGPUsColumn({
        Id: 1,
        EnableGPUManagement: true,
      } as never)
    );
    expect(r1.current).toBe(true);

    mocked.mockReturnValue(false);
    const { result: r2 } = renderHook(() =>
      useShowGPUsColumn({
        Id: 1,
        EnableGPUManagement: true,
      } as never)
    );
    expect(r2.current).toBe(false);

    mocked.mockReturnValue(true);
    const { result: r3 } = renderHook(() =>
      useShowGPUsColumn({
        Id: 1,
        EnableGPUManagement: false,
      } as never)
    );
    expect(r3.current).toBe(false);

    mocked.mockReturnValue(true);
    const { result: r4 } = renderHook(() => useShowGPUsColumn(undefined));
    expect(r4.current).toBe(false);
  });
});
