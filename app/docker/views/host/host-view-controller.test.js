import { beforeEach, describe, expect, it, vi } from 'vitest';

const { controllerState, angularMock, moduleApi } = vi.hoisted(() => {
  const controllerState = { ctor: null };
  const moduleApi = {
    controller: vi.fn((_name, depsOrFn) => {
      controllerState.ctor = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
    component: vi.fn(() => moduleApi),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { controllerState, angularMock, moduleApi };
});

vi.mock('angular', () => ({ default: angularMock, module: angularMock.module }));
await import('./host-view-controller.js');
await import('./host-view.js');
const hostViewComponentDef = moduleApi.component.mock.calls.find((c) => c[0] === 'hostView');

function deferred() {
  let resolve; let reject;
  const p = new Promise((res, rej) => { resolve = res; reject = rej; });
  p.resolve = resolve; p.reject = reject; return p;
}
function flush() { return Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve()); }

function buildController({
  agentProxy = false,
  agentApiVersion = 1,
  enableHostManagementFeatures = false,
  isAdmin = true,
  versionError = null,
} = {}) {
  const ctrl = {
    endpoint: { Id: 3, SecuritySettings: { enableHostManagementFeatures } },
  };
  const versionPromise = deferred();
  const infoPromise = deferred();
  const $q = {
    all: (obj) => Promise.all([obj.version, obj.info]).then(([version, info]) => ({ version, info })),
  };
  const SystemService = {
    version: vi.fn(() => versionPromise),
    info: vi.fn(() => infoPromise),
  };
  const Notifications = { error: vi.fn() };
  const StateManager = {
    getState: () => ({
      endpoint: { mode: { agentProxy }, agentApiVersion },
    }),
  };
  const Authentication = { isAdmin: vi.fn(() => isAdmin) };

  controllerState.ctor.call(ctrl, $q, SystemService, Notifications, StateManager, Authentication);

  async function settle({
    version = { Version: '24.0', ApiVersion: '1.43' },
    info = {
      DockerRootDir: '/var/lib/docker',
      Driver: 'overlay2',
      LoggingDriver: 'json-file',
      Plugins: { Volume: ['local'], Network: ['bridge'] },
      Architecture: 'x86_64',
      OSType: 'linux',
      OperatingSystem: 'Ubuntu',
      Name: 'docker-host',
      KernelVersion: '6.1',
      NCPU: 4,
      MemTotal: 8,
    },
  } = {}) {
    const init = ctrl.$onInit();
    if (versionError) {
      versionPromise.reject(versionError);
      infoPromise.reject(versionError);
    } else {
      versionPromise.resolve(version);
      infoPromise.resolve(info);
    }
    await Promise.allSettled([versionPromise, infoPromise]);
    await flush();
    await init;
    await flush();
  }

  return { ctrl, SystemService, Notifications, settle };
}

describe('REQ-HOST local host view controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads engine and host details for a local Docker endpoint', async () => {
    const ctx = buildController();
    await ctx.settle();
    expect(ctx.ctrl.engineDetails.releaseVersion).toBe('24.0');
    expect(ctx.ctrl.hostDetails.name).toBe('docker-host');
    expect(ctx.ctrl.hostDetails.totalCPU).toBe(4);
    expect(ctx.ctrl.state.isAgent).toBe(false);
  });

  it('REQ-TAI-007 loads no agent host info (devices, disks) even with host management features on', async () => {
    const ctx = buildController({ agentProxy: true, agentApiVersion: 2, enableHostManagementFeatures: true });
    await ctx.settle();
    expect(ctx.ctrl.hostDetails.name).toBe('docker-host');
    expect(ctx.ctrl).not.toHaveProperty('devices');
    expect(ctx.ctrl).not.toHaveProperty('disks');
  });

  it('notifies when system details fail', async () => {
    const err = new Error('down');
    const ctx = buildController({ versionError: err });
    await ctx.settle();
    expect(ctx.Notifications.error).toHaveBeenCalledWith(
      'Failure',
      err,
      'Unable to retrieve engine details'
    );
  });
});

describe('REQ-HOST hostView component', () => {
  it('registers the hostView component', () => {
    expect(hostViewComponentDef).toBeTruthy();
    expect(hostViewComponentDef[1]).toEqual(
      expect.objectContaining({
        templateUrl: './host-view.html',
        controller: 'HostViewController',
      })
    );
  });
});
