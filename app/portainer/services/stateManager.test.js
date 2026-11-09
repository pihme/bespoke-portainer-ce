import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockQ } from './angularFactoryHelpers.test.js';

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

await import('./stateManager.js');

function buildManager(overrides = {}) {
  const $async = (fn) => fn();
  const $q = mockQ();
  const SystemService = {
    version: vi.fn(() => Promise.resolve({ ApiVersion: '1.41' })),
    info: vi.fn(() => Promise.resolve({ Swarm: {} })),
  };
  const InfoHelper = {
    determineEndpointMode: vi.fn(() => ({ provider: 'DOCKER_STANDALONE', agentProxy: false })),
  };
  const LocalStorage = {
    storeUIState: vi.fn(),
    storeApplicationState: vi.fn(),
    storeEndpointState: vi.fn(),
    cleanEndpointState: vi.fn(),
    getEndpointState: vi.fn(() => null),
    getApplicationState: vi.fn(() => null),
    getUIState: vi.fn(() => null),
  };
  const SettingsService = {
    publicSettings: vi.fn(() =>
      Promise.resolve({
        LogoURL: 'logo',
        SnapshotInterval: '5m',
        EnableEdgeComputeFeatures: false,
      })
    ),
  };
  const StatusService = {
    status: vi.fn(() => Promise.resolve({ Version: '2.45', Edition: 'CE', InstanceID: 'iid' })),
  };
  const AgentPingService = { ping: vi.fn(() => Promise.resolve({ version: 2 })) };
  const EndpointProvider = { clean: vi.fn() };
  const deps = {
    $async,
    $q,
    SystemService,
    InfoHelper,
    LocalStorage,
    SettingsService,
    StatusService,
    APPLICATION_CACHE_VALIDITY: 3600,
    AgentPingService,
    EndpointProvider,
    ...overrides,
  };
  const manager = factoryState.factory(
    deps.$async,
    deps.$q,
    deps.SystemService,
    deps.InfoHelper,
    deps.LocalStorage,
    deps.SettingsService,
    deps.StatusService,
    deps.APPLICATION_CACHE_VALIDITY,
    deps.AgentPingService,
    deps.EndpointProvider
  );
  return { manager, ...deps };
}

describe('REQ-SET-01 StateManager local Docker state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dismiss and password-skip helpers persist UI state', () => {
    const { manager, LocalStorage } = buildManager();
    manager.dismissInformationPanel('welcome');
    manager.dismissImportantInformation('hash');
    manager.setRequiredPasswordLength(12);
    manager.setPasswordChangeSkipped(1);
    manager.resetPasswordChangeSkips(1);
    manager.clearPasswordChangeSkips();
    expect(LocalStorage.storeUIState).toHaveBeenCalled();
    expect(manager.getState().UI.dismissedInfoPanels.welcome).toBe(true);
  });

  it('updateLogo and updateSnapshotInterval persist application state', () => {
    const { manager, LocalStorage } = buildManager();
    manager.updateLogo('/logo.svg');
    manager.updateSnapshotInterval('10m');
    expect(manager.getState().application.logo).toBe('/logo.svg');
    expect(manager.getState().application.snapshotInterval).toBe('10m');
    expect(LocalStorage.storeApplicationState).toHaveBeenCalled();
  });

  it('clean and cleanEndpoint clear endpoint state', () => {
    const { manager, EndpointProvider, LocalStorage } = buildManager();
    manager.getState().endpoint = { name: 'local' };
    manager.clean();
    expect(manager.getState().endpoint).toEqual({});
    expect(EndpointProvider.clean).toHaveBeenCalled();
    expect(LocalStorage.cleanEndpointState).toHaveBeenCalled();
  });

  it('initialize loads application state from settings when cache is missing', async () => {
    const { manager, SettingsService, StatusService, LocalStorage } = buildManager();
    const state = await manager.initialize();
    expect(SettingsService.publicSettings).toHaveBeenCalled();
    expect(StatusService.status).toHaveBeenCalled();
    expect(state.application.version).toBe('2.45');
    expect(state.loading).toBe(false);
    expect(LocalStorage.storeApplicationState).toHaveBeenCalled();
  });

  it('initialize reuses a still-valid cached application state', async () => {
    const now = Math.floor(Date.now() / 1000);
    const { manager, SettingsService, LocalStorage } = buildManager({
      LocalStorage: {
        storeUIState: vi.fn(),
        storeApplicationState: vi.fn(),
        storeEndpointState: vi.fn(),
        cleanEndpointState: vi.fn(),
        getEndpointState: vi.fn(() => ({ name: 'cached-ep' })),
        getApplicationState: vi.fn(() => ({
          version: 'cached',
          validity: now,
          instanceId: 'iid',
        })),
        getUIState: vi.fn(() => ({ dismissedInfoHash: 'x', timesPasswordChangeSkipped: {} })),
      },
    });
    const state = await manager.initialize();
    expect(SettingsService.publicSettings).not.toHaveBeenCalled();
    expect(state.application.version).toBe('cached');
    expect(state.endpoint.name).toBe('cached-ep');
    expect(state.UI.dismissedInfoHash).toBe('x');
    void LocalStorage;
  });

  it('updateEndpointState stores Docker standalone mode for a local endpoint', async () => {
    const { manager, SystemService, InfoHelper, LocalStorage } = buildManager();
    await manager.updateEndpointState({ Id: 1, Name: 'local', Type: 1, Status: 1 });
    expect(SystemService.version).toHaveBeenCalled();
    expect(InfoHelper.determineEndpointMode).toHaveBeenCalled();
    expect(manager.getState().endpoint.name).toBe('local');
    expect(manager.getState().endpoint.apiVersion).toBe(1.41);
    expect(LocalStorage.storeEndpointState).toHaveBeenCalled();
  });
});
