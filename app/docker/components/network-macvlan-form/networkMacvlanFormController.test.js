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

function angularQAll(map) {
  const keys = Object.keys(map);
  return Promise.all(keys.map((k) => Promise.resolve(map[k]))).then((vals) => {
    const out = {};
    keys.forEach((k, i) => {
      out[k] = vals[i];
    });
    return out;
  });
}

describe('NetworkMacvlanFormController local macvlan', () => {
  let NodeService;
  let NetworkService;
  let Notifications;
  let $scope;
  let Authentication;
  let $q;
  let lastAllPromise;

  beforeEach(() => {
    $scope = { $evalAsync: (fn) => fn() };
    Authentication = { isAdmin: vi.fn(() => true) };
    Notifications = { error: vi.fn() };
    NodeService = { nodes: vi.fn() };
    NetworkService = { networks: vi.fn() };
    lastAllPromise = null;
    $q = {
      all: vi.fn((map) => {
        lastAllPromise = angularQAll(map);
        return lastAllPromise;
      }),
    };
  });

  function createCtrl(overrides = {}) {
    const ctrl = {
      data: {
        Scope: 'local',
        SelectedNetworkConfig: null,
        DatatableState: { selectedItems: [] },
      },
      applicationState: {
        endpoint: { mode: { provider: 'DOCKER_STANDALONE' }, apiVersion: 1.41 },
      },
      ...overrides,
    };
    controllerState.ctor.call(
      ctrl,
      $q,
      NodeService,
      NetworkService,
      Notifications,
      $scope,
      Authentication
    );
    return ctrl;
  }

  async function flushInit(ctrl) {
    ctrl.$onInit();
    await lastAllPromise;
    // allow then/catch microtasks
    await Promise.resolve();
    await Promise.resolve();
  }

  it('requires node selection only for local scope with a datatable', () => {
    const ctrl = createCtrl();
    expect(ctrl.requiredNodeSelection()).toBe(0);
    ctrl.data.DatatableState.selectedItems = ['n1'];
    expect(ctrl.requiredNodeSelection()).toBe(1);
    ctrl.data.Scope = 'swarm';
    expect(ctrl.requiredNodeSelection()).toBe(false);
    ctrl.data.Scope = 'local';
    ctrl.data.DatatableState = undefined;
    expect(ctrl.requiredNodeSelection()).toBe(false);
  });

  it('requires config selection only for swarm scope', () => {
    const ctrl = createCtrl();
    expect(ctrl.requiredConfigSelection()).toBe(false);
    ctrl.data.Scope = 'swarm';
    expect(ctrl.requiredConfigSelection()).toBe(true);
    ctrl.data.SelectedNetworkConfig = { Id: 'cfg' };
    expect(ctrl.requiredConfigSelection()).toBe(false);
  });

  it('updates selected nodes and scope asynchronously', () => {
    const ctrl = createCtrl();
    ctrl.onChangeSelectedNodes(['a', 'b']);
    expect(ctrl.data.DatatableState.selectedItems).toEqual(['a', 'b']);
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
    expect(ctrl.isAdmin).toBe(true);
    expect(NetworkService.networks).toHaveBeenCalledWith(true, false, false);
    expect(ctrl.availableNetworks).toEqual([{ Name: 'cfg', ConfigOnly: true }]);
    expect(ctrl.options).toEqual([{ id: 'opt', hasConfigs: true }]);
    expect(ctrl.nodes).toBeUndefined();
  });

  it('loads swarm nodes when the provider is swarm mode', async () => {
    NodeService.nodes.mockReturnValue(Promise.resolve([{ Id: 'node-1' }]));
    NetworkService.networks.mockReturnValue(
      Promise.resolve([{ Name: 'cfg', ConfigOnly: true }])
    );
    const ctrl = createCtrl({
      applicationState: {
        endpoint: { mode: { provider: 'DOCKER_SWARM_MODE' }, apiVersion: 1.3 },
      },
    });
    await flushInit(ctrl);
    expect(NodeService.nodes).toHaveBeenCalled();
    expect(ctrl.nodes).toEqual([{ Id: 'node-1' }]);
    expect(NetworkService.networks).toHaveBeenCalledWith(true, false, true);
  });

  it('notifies when macvlan info cannot be loaded', async () => {
    $q.all.mockImplementation(() => {
      lastAllPromise = Promise.reject(new Error('boom'));
      // prevent unhandled rejection noise
      lastAllPromise.catch(() => {});
      return lastAllPromise;
    });
    const ctrl = createCtrl();
    ctrl.$onInit();
    await lastAllPromise.catch(() => {});
    await Promise.resolve();
    await Promise.resolve();
    expect(Notifications.error).toHaveBeenCalledWith(
      'Failure',
      expect.any(Error),
      'Unable to retrieve informations for macvlan'
    );
  });
});
