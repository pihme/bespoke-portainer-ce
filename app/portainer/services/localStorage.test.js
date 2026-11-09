import { beforeEach, describe, expect, it, vi } from 'vitest';


const { factoryState, angularMock } = vi.hoisted(() => {
  const { factoryState, angularMock } = (() => {
    const factoryState = { factory: null };
    const moduleApi = {
      factory: vi.fn((_name, depsOrFn) => {
        factoryState.factory = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
        return moduleApi;
      }),
      service: vi.fn(),
    };
    const angularMock = { module: vi.fn(() => moduleApi) };
    globalThis.angular = angularMock;
    return { factoryState, angularMock };
  })();
  return { factoryState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

await import('./localStorage.js');

function buildService(store = {}) {
  const localStorageService = {
    set: vi.fn((k, v) => {
      store[k] = v;
    }),
    get: vi.fn((k) => (k in store ? store[k] : null)),
    remove: vi.fn((...keys) => {
      keys.forEach((k) => delete store[k]);
    }),
    clearAll: vi.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
  };
  return { service: factoryState.factory(localStorageService), localStorageService, store };
}

describe('REQ-SET-01 LocalStorage UI and endpoint state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stores and loads endpoint, application and UI state', () => {
    const { service, localStorageService } = buildService();
    service.storeEndpointState({ name: 'local' });
    service.storeApplicationState({ logo: 'x' });
    service.storeUIState({ dismissedInfoHash: 'h' });
    expect(localStorageService.set).toHaveBeenCalledWith('ENDPOINT_STATE', { name: 'local' });
    expect(service.getEndpointState()).toEqual({ name: 'local' });
    expect(service.getApplicationState()).toEqual({ logo: 'x' });
    expect(service.getUIState()).toEqual({ dismissedInfoHash: 'h' });
    service.cleanEndpointState();
    expect(localStorageService.remove).toHaveBeenCalledWith('ENDPOINT_STATE');
  });

  it('stores the local operator id and has no login/logout bookkeeping', () => {
    const { service, localStorageService, store } = buildService();
    service.storeUserId(7);
    expect(service.getUserId()).toBe(7);
    service.deleteUserId();
    expect(localStorageService.remove).toHaveBeenCalledWith('USER_ID');
    // REQ-TAI-001
    expect(service.storeLoginStateUUID).toBeUndefined();
    expect(service.storeLogoutReason).toBeUndefined();
    expect(service.cleanAuthData).toBeUndefined();
    service.clean();
    expect(localStorageService.clearAll).toHaveBeenCalled();
    void store;
  });

  it('stores datatable pagination, order, filters and column visibility', () => {
    const { service } = buildService();
    service.storePaginationLimit('containers', 50);
    expect(service.getPaginationLimit('containers')).toBe(50);
    service.storeDataTableOrder('containers', { key: 'name' });
    expect(service.getDataTableOrder('containers')).toEqual({ key: 'name' });
    service.storeDataTableTextFilters('containers', 'nginx');
    expect(service.getDataTableTextFilters('containers')).toBe('nginx');
    service.storeDataTableFilters('containers', { state: 'running' });
    expect(service.getDataTableFilters('containers')).toEqual({ state: 'running' });
    service.storeDataTableSettings('containers', { density: 'tight' });
    expect(service.getDataTableSettings('containers')).toEqual({ density: 'tight' });
    service.storeDataTableExpandedItems('containers', [1]);
    expect(service.getDataTableExpandedItems('containers')).toEqual([1]);
    service.storeDataTableSelectedItems('containers', [2]);
    expect(service.getDataTableSelectedItems('containers')).toEqual([2]);
    service.storeColumnVisibilitySettings('containers', { image: false });
    expect(service.getColumnVisibilitySettings('containers')).toEqual({ image: false });
    service.storeActiveTab('endpoint', 2);
    expect(service.getActiveTab('endpoint')).toBe(2);
    expect(service.getActiveTab('missing')).toBe(0);
    service.storeJobImage('busybox');
    expect(service.getJobImage()).toBe('busybox');
  });
});
