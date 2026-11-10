import { beforeEach, describe, expect, it, vi } from 'vitest';

const { controllerState, angularMock, confirmDeleteMock } = vi.hoisted(() => {
  const controllerState = { ctor: null };
  const moduleApi = {
    controller: vi.fn((_name, depsOrFn) => {
      controllerState.ctor = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { controllerState, angularMock, confirmDeleteMock: vi.fn() };
});

vi.mock('angular', () => ({ default: angularMock, module: angularMock.module }));
vi.mock('@@/modals/confirm', () => ({ confirmDelete: (...a) => confirmDeleteMock(...a) }));

await import('./volumeController.js');

function deferred() {
  let resolve; let reject;
  const p = new Promise((res, rej) => { resolve = res; reject = rej; });
  p.resolve = resolve; p.reject = reject; return p;
}
function flush() { return Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve()); }

function buildController(options = {}) {
  const {
    volumeId = 'vol-1',
    nodeName,
    endpoint = { Id: 3, SecuritySettings: { allowVolumeBrowserForRegularUsers: false } },
    volume = { Id: 'vol-1', Name: 'data' },
    volumeError = null,
    containers = [{ Id: 'c1', Mounts: [{ Name: 'vol-1', Destination: '/data' }], NodeName: 'n1' }],
    containersError = null,
    isAdmin = true,
    agentProxy = false,
  } = options;

  const $scope = {
    applicationState: { endpoint: { mode: { agentProxy } } },
    isCioDriver: false,
  };
  const $state = { reload: vi.fn(), go: vi.fn() };
  const $transition$ = { params: () => ({ id: volumeId, nodeName }) };
  const volumePromise = deferred();
  const containersPromise = deferred();
  const removePromise = deferred();
  const VolumeService = {
    volume: vi.fn(() => volumePromise),
    remove: vi.fn(() => removePromise),
  };
  const ContainerService = { containers: vi.fn(() => containersPromise) };
  const Notifications = { success: vi.fn(), error: vi.fn() };
  const HttpRequestHelper = { setPortainerAgentTargetHeader: vi.fn() };
  const Authentication = { isAdmin: vi.fn(() => isAdmin) };

  controllerState.ctor($scope, $state, $transition$, VolumeService, ContainerService, Notifications, HttpRequestHelper, Authentication, endpoint);

  async function settle() {
    if (volumeError) volumePromise.reject(volumeError); else volumePromise.resolve(volume);
    await volumePromise.catch(() => undefined); await flush();
    if (!volumeError) {
      if (containersError) containersPromise.reject(containersError); else containersPromise.resolve(containers);
      await containersPromise.catch(() => undefined); await flush();
    }
  }

  return { $scope, $state, VolumeService, ContainerService, Notifications, HttpRequestHelper, Authentication, removePromise, settle };
}

describe('REQ-VOL-03 VolumeController local volume details', () => {
  beforeEach(() => { vi.clearAllMocks(); confirmDeleteMock.mockReset(); });

  it('loads volume details and containers using the volume', async () => {
    const ctx = buildController();
    await ctx.settle();
    expect(ctx.HttpRequestHelper.setPortainerAgentTargetHeader).not.toHaveBeenCalled();
    expect(ctx.$scope.volume.Id).toBe('vol-1');
    expect(ctx.$scope.containersUsingVolume).toHaveLength(1);
    expect(ctx.$scope.containersUsingVolume[0].volumeData.Destination).toBe('/data');
    expect(ctx.$scope.showBrowseAction).toBe(false);
  });

  it('enables browse action for admin on agent proxy', async () => {
    const ctx = buildController({ agentProxy: true, isAdmin: true });
    await ctx.settle();
    expect(ctx.$scope.showBrowseAction).toBe(true);
  });

  it('notifies when volume details fail', async () => {
    const err = new Error('missing');
    const ctx = buildController({ volumeError: err });
    await ctx.settle();
    expect(ctx.Notifications.error).toHaveBeenCalledWith('Failure', err, 'Unable to retrieve volume details');
  });

  it('removes the volume after confirm', async () => {
    confirmDeleteMock.mockResolvedValue(true);
    const ctx = buildController();
    await ctx.settle();
    ctx.$scope.removeVolume();
    await flush();
    ctx.removePromise.resolve();
    await flush();
    expect(ctx.VolumeService.remove).toHaveBeenCalledWith('vol-1');
    expect(ctx.Notifications.success).toHaveBeenCalled();
    expect(ctx.$state.go).toHaveBeenCalledWith('docker.volumes', {});
  });

  it('does not remove when confirm is cancelled', async () => {
    confirmDeleteMock.mockResolvedValue(false);
    const ctx = buildController();
    await ctx.settle();
    ctx.$scope.removeVolume();
    await flush();
    expect(ctx.VolumeService.remove).not.toHaveBeenCalled();
  });

  it('notifies when remove fails', async () => {
    confirmDeleteMock.mockResolvedValue(true);
    const err = new Error('busy');
    const ctx = buildController();
    await ctx.settle();
    ctx.$scope.removeVolume();
    await flush();
    ctx.removePromise.reject(err);
    await flush();
    expect(ctx.Notifications.error).toHaveBeenCalledWith('Failure', err, 'Unable to remove volume');
  });

  it('REQ-TAI-001 exposes no ownership panel hooks', async () => {
    const ctx = buildController();
    await ctx.settle();
    expect(ctx.$scope.resourceType).toBeUndefined();
    expect(ctx.$scope.onUpdateResourceControlSuccess).toBeUndefined();
  });

});
