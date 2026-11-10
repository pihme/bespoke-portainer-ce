import { describe, expect, it, vi } from 'vitest';

vi.mock('axios-progress-bar', () => ({
  loadProgressBar: vi.fn(),
}));
vi.mock('@/portainer/services/http-request.helper', () => ({
  CACHE_DURATION: 1000,
  dispatchCacheRefreshEventIfNeeded: vi.fn(),
}));
vi.mock('@/portainer/services/dockerMaxApiVersionInterceptor', () => ({
  dockerMaxAPIVersionInterceptor: (c: unknown) => c,
}));

import * as axiosModule from './axios';
import axios, { cache, updateAxiosAdapter } from './axios';

describe('axios client helpers', () => {
  it('exposes a configured axios instance with api baseURL', () => {
    expect(axios.defaults.baseURL).toBe('api');
    expect(typeof axios.get).toBe('function');
  });

  it('clears the in-memory cache store', () => {
    expect(() => cache.store.clear()).not.toThrow();
  });

  // REQ-TAI-007: per-node targeting is removed; no agent interceptor decorates
  // docker requests with X-PortainerAgent-Target any more.
  it('REQ-TAI-007 has no agent interceptor or agent target header', () => {
    expect(Object.keys(axiosModule)).not.toContain('agentInterceptor');
    expect(Object.keys(axiosModule)).not.toContain('agentTargetHeader');
  });

  it('updateAxiosAdapter is a no-op when cache is already enabled or disabled', () => {
    expect(() => updateAxiosAdapter(false)).not.toThrow();
    expect(() => updateAxiosAdapter(true)).not.toThrow();
  });
});
