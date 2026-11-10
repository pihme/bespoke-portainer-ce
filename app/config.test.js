import { beforeEach, describe, expect, it, vi } from 'vitest';

const dispatchCacheRefreshEventIfNeeded = vi.fn();

vi.mock('./portainer/services/http-request.helper', () => ({
  dispatchCacheRefreshEventIfNeeded: (...args) =>
    dispatchCacheRefreshEventIfNeeded(...args),
}));

import { configApp } from './config';

describe('configApp', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'testing');
  });

  it('configures http defaults, interceptors, tooltips, and loading bar', () => {
    const $urlRouterProvider = { otherwise: vi.fn() };
    const interceptors = [];
    const $httpProvider = {
      interceptors,
      defaults: { headers: { post: {}, put: {}, patch: {} } },
    };
    const localStorageServiceProvider = { setPrefix: vi.fn() };
    const $uibTooltipProvider = { setTriggers: vi.fn() };
    const $compileProvider = { debugInfoEnabled: vi.fn() };
    const cfpLoadingBarProvider = {};

    configApp(
      $urlRouterProvider,
      $httpProvider,
      localStorageServiceProvider,
      $uibTooltipProvider,
      $compileProvider,
      cfpLoadingBarProvider
    );

    expect($compileProvider.debugInfoEnabled).toHaveBeenCalledWith(false);
    expect(localStorageServiceProvider.setPrefix).toHaveBeenCalledWith(
      'portainer'
    );
    expect($httpProvider.defaults.headers.post['Content-Type']).toBe(
      'application/json'
    );
    expect(cfpLoadingBarProvider.includeSpinner).toBe(false);
    expect(cfpLoadingBarProvider.parentSelector).toBe(
      '#loadingbar-placeholder'
    );
    expect(cfpLoadingBarProvider.latencyThreshold).toBe(600);
    expect($urlRouterProvider.otherwise).toHaveBeenCalledWith('/auth');
    // REQ-TAI-007: only the cache interceptor; the agent target interceptor is removed.
    expect(interceptors).toHaveLength(1);

    const cacheInterceptor = interceptors[0]();
    const req = { method: 'GET', url: '/api/x' };
    expect(cacheInterceptor.request(req)).toBe(req);
    expect(dispatchCacheRefreshEventIfNeeded).toHaveBeenCalledWith(req);
  });
});
