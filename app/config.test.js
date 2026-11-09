import { beforeEach, describe, expect, it, vi } from 'vitest';

const agentInterceptor = vi.fn((c) => c);
const dispatchCacheRefreshEventIfNeeded = vi.fn();

vi.mock('@/react/portainer/services/axios/axios', () => ({
  agentInterceptor: (...args) => agentInterceptor(...args),
}));

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
    expect(interceptors).toHaveLength(2);

    const cacheInterceptor = interceptors[0]();
    const req = { method: 'GET', url: '/api/x' };
    expect(cacheInterceptor.request(req)).toBe(req);
    expect(dispatchCacheRefreshEventIfNeeded).toHaveBeenCalledWith(req);

    const agent = interceptors[1]();
    agent.request(req);
    expect(agentInterceptor).toHaveBeenCalledWith(req);
  });
});
