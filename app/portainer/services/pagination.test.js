import { beforeEach, describe, expect, it, vi } from 'vitest';

const { factoryState, angularMock } = vi.hoisted(() => {
  const factoryState = { factory: null };
  const moduleApi = {
    factory: vi.fn((_name, depsOrFn) => {
      factoryState.factory = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { factoryState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

await import('./pagination.js');

describe('REQ-SET-01 PaginationService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getPaginationLimit falls back to PAGINATION_MAX_ITEMS then uses stored limit', () => {
    const LocalStorage = {
      getPaginationLimit: vi.fn(() => null),
      storePaginationLimit: vi.fn(),
    };
    const service = factoryState.factory(LocalStorage, 25);
    expect(service.getPaginationLimit('containers')).toBe('25');
    LocalStorage.getPaginationLimit.mockReturnValue(50);
    expect(service.getPaginationLimit('containers')).toBe('50');
    service.setPaginationLimit('containers', 100);
    expect(LocalStorage.storePaginationLimit).toHaveBeenCalledWith('containers', 100);
  });
});
