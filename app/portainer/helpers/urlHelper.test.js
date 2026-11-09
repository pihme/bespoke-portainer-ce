import { describe, it, expect, vi, beforeEach } from 'vitest';

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

await import('./urlHelper.js');

function urlHelper($window) {
  return factoryState.factory($window);
}

describe('URLHelper query parameter helpers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getParameter returns the value for a query key', () => {
    const $window = {
      location: {
        search: '?token=abc&next=/home',
        origin: 'http://localhost:9000',
        pathname: '/',
        hash: '#!/auth',
        replace: vi.fn(),
      },
    };
    const helper = urlHelper($window);
    expect(helper.getParameter('token')).toBe('abc');
    expect(helper.getParameter('next')).toBe('/home');
    expect(helper.getParameter('missing')).toBeUndefined();
  });

  it('getParameter works when search has no leading question mark noise', () => {
    const $window = {
      location: {
        search: 'foo=1&bar=2',
        origin: 'http://localhost:9000',
        pathname: '/app',
        hash: '',
        replace: vi.fn(),
      },
    };
    const helper = urlHelper($window);
    expect(helper.getParameter('bar')).toBe('2');
  });

  it('cleanParameters replaces the location without the query string', () => {
    const replace = vi.fn();
    const $window = {
      location: {
        search: '?token=abc',
        origin: 'http://localhost:9000',
        pathname: '/portainer/',
        hash: '#!/home',
        replace,
      },
    };
    const helper = urlHelper($window);
    helper.cleanParameters();
    expect(replace).toHaveBeenCalledWith('http://localhost:9000/portainer/#!/home');
  });
});
