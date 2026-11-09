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

vi.mock('./session-storage', () => ({
  clear: vi.fn(),
}));

await import('./authentication.js');
const { getCurrentUser } = await import('../users/queries/useLoadCurrentUser');
const userHelpers = await import('../users/user.helpers');
const { clear: clearSessionStorage } = await import('./session-storage');
const { hasAuthorizations: useUserHasAuthorization } = await import('@/react/hooks/useUser');

function buildAuth(overrides = {}) {
  const $async = (fn, ...args) => fn(...args);
  const $state = { go: vi.fn() };
  const Auth = {
    login: vi.fn(() => ({ $promise: Promise.resolve({}) })),
    logout: vi.fn(() => ({ $promise: Promise.resolve({}) })),
  };
  const OAuth = { validate: vi.fn(() => ({ $promise: Promise.resolve({}) })) };
  const LocalStorage = {
    getUserId: vi.fn(() => null),
    storeUserId: vi.fn(),
    cleanAuthData: vi.fn(),
    storeLoginStateUUID: vi.fn(),
  };
  const StateManager = { clean: vi.fn() };
  const EndpointProvider = {
    clean: vi.fn(),
    currentEndpoint: vi.fn(() => ({ Id: 1 })),
    endpointID: vi.fn(() => 1),
  };
  const ThemeManager = { autoTheme: vi.fn(), setTheme: vi.fn() };
  const auth = factoryState.factory($async, $state, Auth, OAuth, LocalStorage, StateManager, EndpointProvider, ThemeManager);
  return { auth, $state, Auth, OAuth, LocalStorage, StateManager, EndpointProvider, ThemeManager, ...overrides };
}

describe('REQ-AUTH-03 Authentication session plumbing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.ddExtension;
  });

  it('login loads user data and applies theme', async () => {
    getCurrentUser.mockResolvedValue({
      Username: 'admin',
      Id: 1,
      Role: 1,
      forceChangePassword: false,
      EndpointAuthorizations: {},
      PortainerAuthorizations: {},
      ThemeSettings: { color: 'dark' },
    });
    const { auth, Auth, LocalStorage, ThemeManager } = buildAuth();
    await auth.login('admin', 'secret');
    expect(Auth.login).toHaveBeenCalledWith({ username: 'admin', password: 'secret' });
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.getUserDetails()).toMatchObject({ username: 'admin', ID: 1 });
    expect(ThemeManager.setTheme).toHaveBeenCalledWith('dark');
    expect(LocalStorage.storeUserId).toHaveBeenCalledWith(1);
  });

  it('logout clears session storage and auth data when authenticated', async () => {
    getCurrentUser.mockResolvedValue({
      Username: 'admin',
      Id: 1,
      Role: 1,
      ThemeSettings: { color: 'auto' },
      EndpointAuthorizations: {},
      PortainerAuthorizations: {},
    });
    const { auth, Auth, LocalStorage, StateManager, EndpointProvider, ThemeManager } = buildAuth();
    await auth.login('admin', 'secret');
    expect(ThemeManager.autoTheme).toHaveBeenCalled();
    await auth.logout();
    expect(Auth.logout).toHaveBeenCalled();
    expect(clearSessionStorage).toHaveBeenCalled();
    expect(StateManager.clean).toHaveBeenCalled();
    expect(EndpointProvider.clean).toHaveBeenCalled();
    expect(LocalStorage.cleanAuthData).toHaveBeenCalled();
    expect(auth.isAuthenticated()).toBe(false);
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
    const { auth, $state, EndpointProvider } = buildAuth();
    await auth.login('admin', 'x');
    expect(auth.isAdmin()).toBe(true);
    expect(auth.isPureAdmin()).toBe(true);
    expect(auth.hasAuthorizations(['DockerContainerList'])).toBe(true);
    expect(userHelpers.isEdgeAdmin).toHaveBeenCalled();
    useUserHasAuthorization.mockReturnValueOnce(false);
    userHelpers.isEdgeAdmin.mockReturnValueOnce(false);
    auth.redirectIfUnauthorized(['Nope']);
    // when still edge admin from previous mock, hasAuthorizations short-circuits true —
    // force non-admin path:
    userHelpers.isEdgeAdmin.mockReturnValue(false);
    useUserHasAuthorization.mockReturnValue(false);
    auth.redirectIfUnauthorized(['Nope']);
    expect($state.go).toHaveBeenCalledWith('portainer.home');
    void EndpointProvider;
  });

  it('init returns true after loading user data', async () => {
    getCurrentUser.mockResolvedValue({
      Username: 'admin',
      Id: 2,
      Role: 1,
      ThemeSettings: { color: 'light' },
      EndpointAuthorizations: {},
      PortainerAuthorizations: {},
    });
    const { auth, LocalStorage } = buildAuth();
    LocalStorage.getUserId.mockReturnValue(null);
    await expect(auth.init()).resolves.toBe(true);
    expect(auth.isAuthenticated()).toBe(true);
  });
});
