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

vi.mock('@/react/hooks/useUser', () => ({
  hasAuthorizations: vi.fn(() => true),
}));

vi.mock('../users/queries/useLoadCurrentUser', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('../users/user.helpers', () => ({
  isEdgeAdmin: vi.fn(() => true),
  isPureAdmin: vi.fn(() => true),
}));

await import('./authentication.js');
const { getCurrentUser } = await import('../users/queries/useLoadCurrentUser');
const userHelpers = await import('../users/user.helpers');
const { hasAuthorizations: useUserHasAuthorization } = await import('@/react/hooks/useUser');

function buildAuth() {
  const $async = (fn, ...args) => fn(...args);
  const $state = { go: vi.fn() };
  const LocalStorage = {
    getUserId: vi.fn(() => null),
    storeUserId: vi.fn(),
  };
  const EndpointProvider = {
    currentEndpoint: vi.fn(() => ({ Id: 1 })),
    endpointID: vi.fn(() => 1),
  };
  const ThemeManager = { autoTheme: vi.fn(), setTheme: vi.fn() };
  const auth = factoryState.factory($async, $state, LocalStorage, EndpointProvider, ThemeManager);
  return { auth, $state, LocalStorage, EndpointProvider, ThemeManager };
}

describe('REQ-TAI-001 Authentication serves the local operator without login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes no login, logout or OAuth entry points', () => {
    const { auth } = buildAuth();
    expect(auth.login).toBeUndefined();
    expect(auth.logout).toBeUndefined();
    expect(auth.OAuthLogin).toBeUndefined();
  });

  it('init loads the local operator from /users/me and applies the stored theme', async () => {
    getCurrentUser.mockResolvedValue({
      Username: 'admin',
      Id: 2,
      Role: 1,
      ThemeSettings: { color: 'light' },
      EndpointAuthorizations: {},
      PortainerAuthorizations: {},
    });
    const { auth, LocalStorage, ThemeManager } = buildAuth();
    await expect(auth.init()).resolves.toBe(true);
    expect(getCurrentUser).toHaveBeenCalledTimes(1);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.getUserDetails()).toMatchObject({ username: 'admin', ID: 2, role: 1 });
    expect(ThemeManager.setTheme).toHaveBeenCalledWith('light');
    expect(LocalStorage.storeUserId).toHaveBeenCalledWith(2);
  });

  it('init falls back to the auto theme when none is stored', async () => {
    getCurrentUser.mockResolvedValue({ Username: 'admin', Id: 1, Role: 1, ThemeSettings: {} });
    const { auth, ThemeManager } = buildAuth();
    await auth.init();
    expect(ThemeManager.autoTheme).toHaveBeenCalled();
  });

  it('init reuses the loaded operator when the stored id matches', async () => {
    getCurrentUser.mockResolvedValue({ Username: 'admin', Id: 3, Role: 1, ThemeSettings: {} });
    const { auth, LocalStorage } = buildAuth();
    await auth.init();
    LocalStorage.getUserId.mockReturnValue(3);
    await expect(auth.init()).resolves.toBe(true);
    expect(getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('init rejects when the local operator cannot be loaded', async () => {
    getCurrentUser.mockRejectedValue(new Error('down'));
    const { auth } = buildAuth();
    await expect(auth.init()).rejects.toThrow('down');
  });

  it('isAdmin/isPureAdmin/hasAuthorizations and redirectIfUnauthorized', async () => {
    getCurrentUser.mockResolvedValue({
      Username: 'admin',
      Id: 1,
      Role: 1,
      ThemeSettings: {},
      EndpointAuthorizations: { 1: ['DockerContainerList'] },
      PortainerAuthorizations: {},
    });
    const { auth, $state } = buildAuth();
    await auth.init();
    expect(auth.isAdmin()).toBe(true);
    expect(auth.isPureAdmin()).toBe(true);
    expect(auth.hasAuthorizations(['DockerContainerList'])).toBe(true);
    expect(userHelpers.isEdgeAdmin).toHaveBeenCalled();
    userHelpers.isEdgeAdmin.mockReturnValue(false);
    useUserHasAuthorization.mockReturnValue(false);
    auth.redirectIfUnauthorized(['Nope']);
    expect($state.go).toHaveBeenCalledWith('portainer.home');
  });
});
