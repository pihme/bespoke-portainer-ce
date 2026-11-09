import { describe, expect, it, vi, beforeEach } from 'vitest';

const { controllerState, angularMock } = vi.hoisted(() => {
  const controllerState = { ctor: null };
  const moduleApi = {
    controller: vi.fn((_name, depsOrFn) => {
      controllerState.ctor =
        Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
  };
  const angularMock = {
    module: vi.fn(() => moduleApi),
  };
  globalThis.angular = angularMock;
  return { controllerState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('@/react/docker/networks/CreateView/macvlanOptions', () => ({
  getOptions: vi.fn((hasConfigs) => [{ id: 'opt', hasConfigs }]),
}));

await import('./networkMacvlanFormController.js');

describe('NetworkMacvlanFormController local macvlan', () => {
  let NetworkService;
  let Notifications;
  let $scope;

  beforeEach(() => {
    $scope = { $evalAsync: (fn) => fn() };
    Notifications = { error: vi.fn() };
    NetworkService = { networks: vi.fn() };
  });

  function createCtrl(overrides = {}) {
    const ctrl = {
      data: {
        Scope: 'local',
        SelectedNetworkConfig: null,
      },
      applicationState: {
        endpoint: { mode: { provider: 'DOCKER_STANDALONE' }, apiVersion: 1.41 },
      },
      ...overrides,
    };
    controllerState.ctor.call(ctrl, NetworkService, Notifications, $scope);
    return ctrl;
  }

  async function flushInit(ctrl) {
    ctrl.$onInit();
    // allow then/catch microtasks
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  it('requires config selection only for the create-from-config scope', () => {
    const ctrl = createCtrl();
    expect(ctrl.requiredConfigSelection()).toBe(false);
    ctrl.data.Scope = 'swarm';
    expect(ctrl.requiredConfigSelection()).toBe(true);
    ctrl.data.SelectedNetworkConfig = { Id: 'cfg' };
    expect(ctrl.requiredConfigSelection()).toBe(false);
  });

  it('updates scope asynchronously', () => {
    const ctrl = createCtrl();
    ctrl.onChangeScope('swarm');
    expect(ctrl.data.Scope).toBe('swarm');
  });

  it('loads config-only networks for a local Docker endpoint', async () => {
    NetworkService.networks.mockReturnValue(
      Promise.resolve([
        { Name: 'cfg', ConfigOnly: true },
        { Name: 'bridge', ConfigOnly: false },
      ])
    );
    const ctrl = createCtrl();
    await flushInit(ctrl);
    expect(NetworkService.networks).toHaveBeenCalledWith(true, false, false);
    expect(ctrl.availableNetworks).toEqual([{ Name: 'cfg', ConfigOnly: true }]);
    expect(ctrl.options).toEqual([{ id: 'opt', hasConfigs: true }]);
  });

  it('REQ-TAI-003 never loads Swarm nodes or a node selection', async () => {
    NetworkService.networks.mockReturnValue(
      Promise.resolve([{ Name: 'cfg', ConfigOnly: true }])
    );
    const ctrl = createCtrl({
      applicationState: {
        endpoint: { mode: { provider: 'DOCKER_SWARM_MODE' }, apiVersion: 1.3 },
      },
    });
    await flushInit(ctrl);
    expect(NetworkService.networks).toHaveBeenCalledWith(true, false, false);
    expect(ctrl.nodes).toBeUndefined();
    expect(ctrl.onChangeSelectedNodes).toBeUndefined();
    expect(ctrl.requiredNodeSelection).toBeUndefined();
  });

  it('notifies when macvlan info cannot be loaded', async () => {
    const failure = Promise.reject(new Error('boom'));
    failure.catch(() => {});
    NetworkService.networks.mockReturnValue(failure);
    const ctrl = createCtrl();
    await flushInit(ctrl);
    expect(Notifications.error).toHaveBeenCalledWith(
      'Failure',
      expect.any(Error),
      'Unable to retrieve informations for macvlan'
    );
  });
});
