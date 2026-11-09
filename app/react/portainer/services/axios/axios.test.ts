import { describe, expect, it, vi } from 'vitest';

vi.mock('axios-progress-bar', () => ({
  loadProgressBar: vi.fn(),
}));
vi.mock('@/portainer/services/http-request.helper', () => ({
  CACHE_DURATION: 1000,
  dispatchCacheRefreshEventIfNeeded: vi.fn(),
  portainerAgentManagerOperation: vi.fn(() => false),
  portainerAgentTargetHeader: vi.fn(() => ''),
}));
vi.mock('@/portainer/services/dockerMaxApiVersionInterceptor', () => ({
  dockerMaxAPIVersionInterceptor: (c: unknown) => c,
}));

import axios, {
  agentInterceptor,
  agentTargetHeader,
  cache,
  updateAxiosAdapter,
} from './axios';

describe('axios client helpers', () => {
  it('exposes a configured axios instance with api baseURL', () => {
    expect(axios.defaults.baseURL).toBe('api');
    expect(typeof axios.get).toBe('function');
  });

  it('clears the in-memory cache store', () => {
    expect(() => cache.store.clear()).not.toThrow();
  });

  it('agentInterceptor leaves non-docker URLs alone', () => {
    const config = { url: '/stacks', headers: {} } as never;
    expect(agentInterceptor(config)).toBe(config);
  });

  it('agentInterceptor passes docker URLs through when no agent target is set', () => {
    const config = {
      url: '/endpoints/1/docker/containers/json',
      headers: {},
    } as never;
    const result = agentInterceptor(config);
    expect(result.url).toContain('/docker/');
    expect(result.headers[agentTargetHeader]).toBeUndefined();
  });

  it('updateAxiosAdapter is a no-op when cache is already enabled or disabled', () => {
    expect(() => updateAxiosAdapter(false)).not.toThrow();
    expect(() => updateAxiosAdapter(true)).not.toThrow();
  });
});
