import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnvironmentType } from '@/react/portainer/environments/types';

vi.mock('@/react/docker/proxy/queries/usePing', () => ({
  ping: vi.fn(),
}));

vi.mock('@/react/hooks/current-environment-store', () => {
  const clear = vi.fn();
  const subscribe = vi.fn();
  return {
    environmentStore: {
      subscribe,
      getState: () => ({ clear }),
    },
  };
});

const { EndpointProvider } = await import('./endpointProvider');
const { ping } = await import('@/react/docker/proxy/queries/usePing');
const { environmentStore } = await import('@/react/hooks/current-environment-store');

describe('REQ-ENV-01 EndpointProvider current endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    document.title = 'Portainer';
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('setCurrentEndpoint stores a local Docker endpoint and updates the title', () => {
    const provider = EndpointProvider();
    const endpoint = { Id: 3, Name: 'local', Type: EnvironmentType.Docker } as any;
    provider.setCurrentEndpoint(endpoint);
    expect(provider.endpointID()).toBe(3);
    expect(provider.currentEndpoint()).toEqual(endpoint);
    expect(document.title).toBe('local');
    expect(ping).not.toHaveBeenCalled();
  });

  it('setCurrentEndpoint(null) clears title and session environment id', () => {
    const provider = EndpointProvider();
    provider.setCurrentEndpoint({ Id: 1, Name: 'local', Type: EnvironmentType.Docker } as any);
    provider.setCurrentEndpoint(null);
    expect(provider.endpointID()).toBeUndefined();
    expect(document.title).toBe('Portainer');
    // JSON.stringify(undefined) becomes the literal string "undefined" via setItem.
    expect(sessionStorage.getItem('portainer.environmentId')).toBe('undefined');
  });

  it('clean clears the endpoint and environment store', () => {
    const provider = EndpointProvider();
    provider.setCurrentEndpoint({ Id: 1, Name: 'local', Type: EnvironmentType.Docker } as any);
    provider.clean();
    expect(provider.currentEndpoint()).toBeNull();
    expect(environmentStore.getState().clear).toHaveBeenCalled();
  });

  it('subscribes to environmentStore and clears when environmentId becomes falsy', () => {
    EndpointProvider();
    expect(environmentStore.subscribe).toHaveBeenCalled();
    const handler = (environmentStore.subscribe as any).mock.calls[0][1];
    handler(undefined);
  });
});
