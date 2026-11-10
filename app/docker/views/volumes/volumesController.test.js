import { beforeEach, describe, expect, it, vi } from 'vitest';

const { controllerState, angularMock } = vi.hoisted(() => {
  const controllerState = { ctor: null };
  const moduleApi = {
    controller: vi.fn((_name, deps) => {
      controllerState.ctor = Array.isArray(deps) ? deps[deps.length - 1] : deps;
      return moduleApi;
    }),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { controllerState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('@/react/common/processItemsInBatches', () => ({
  processItemsInBatches: vi.fn(async (items, fn) => {
    for (const item of items) {
      // eslint-disable-next-line no-await-in-loop
      await fn(item);
    }
  }),
}));

await import('./volumesController.js');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.resolve = resolve;
  promise.reject = reject;
  return promise;
}

function buildController(options = {}) {
  const {
    provider = 'DOCKER_STANDALONE',
    role = 'MANAGER',
    agentProxy = false,
    isAdmin = true,
    allowVolumeBrowserForRegularUsers = false,
    attached = [{ Name: 'vol1', NodeName: '' }],
    dangling = [{ Name: 'vol2', NodeName: '' }],
    volumesError = null,
  } = options;

  const $scope = {
    applicationState: {
      endpoint: { mode: { provider, role, agentProxy } },
    },
    volumes: [],
  };
  const $state = { reload: vi.fn() };
  const Notifications = { success: vi.fn(), error: vi.fn() };
  const Authentication = { isAdmin: vi.fn(() => isAdmin) };
  const endpoint = {
    SecuritySettings: { allowVolumeBrowserForRegularUsers },
  };

  const attachedPromise = deferred();
  const danglingPromise = deferred();
  const VolumeService = {
    volumes: vi.fn((filter) =>
      filter.dangling[0] === 'false' ? attachedPromise : danglingPromise
    ),
    remove: vi.fn(() => Promise.resolve()),
  };

  const $q = {
    all: (obj) =>
      Promise.all(
        Object.entries(obj).map(([k, v]) => Promise.resolve(v).then((val) => [k, val]))
      ).then((entries) => Object.fromEntries(entries)),
  };

  controllerState.ctor(
    $q,
    $scope,
    $state,
    VolumeService,
    Notifications,
    Authentication,
    endpoint
  );

  if (volumesError) {
    attachedPromise.reject(volumesError);
    danglingPromise.reject(volumesError);
  } else {
    attachedPromise.resolve(attached);
    danglingPromise.resolve(dangling);
  }

  return {
    $scope,
    $state,
    Notifications,
    VolumeService,
    Authentication,
  };
}

describe('REQ-VOL-01 VolumesController local Docker volumes list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captures the VolumesController constructor', () => {
    expect(controllerState.ctor).toEqual(expect.any(Function));
  });

  it('merges attached and dangling volumes for a local standalone host', async () => {
    const { $scope, VolumeService } = buildController();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(VolumeService.volumes).toHaveBeenCalledWith({ dangling: ['false'] });
    expect(VolumeService.volumes).toHaveBeenCalledWith({ dangling: ['true'] });
    expect($scope.volumes).toEqual([
      expect.objectContaining({ Name: 'vol1', dangling: false }),
      expect.objectContaining({ Name: 'vol2', dangling: true }),
    ]);
    expect($scope).not.toHaveProperty('showBrowseAction');
  });

  it('REQ-TAI-003 lists volumes without asking for Swarm services on a Swarm manager', async () => {
    const { $scope, VolumeService } = buildController();
    $scope.applicationState.endpoint.mode = { provider: 'DOCKER_SWARM_MODE', role: 'MANAGER' };
    $scope.getVolumes();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(VolumeService.volumes).toHaveBeenCalledTimes(4);
    expect($scope.volumes).toEqual([
      expect.objectContaining({ Name: 'vol1', dangling: false }),
      expect.objectContaining({ Name: 'vol2', dangling: true }),
    ]);
  });

  it('REQ-TAI-010 shows no browse action even for admins on an agent proxy endpoint', async () => {
    const { $scope } = buildController({
      agentProxy: true,
      isAdmin: true,
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect($scope).not.toHaveProperty('showBrowseAction');
  });

  it('notifies when listing volumes fails', async () => {
    const err = new Error('list failed');
    const { Notifications } = buildController({ volumesError: err });
    await vi.waitFor(() => {
      expect(Notifications.error).toHaveBeenCalledWith(
        'Failure',
        err,
        'Unable to retrieve volumes'
      );
    });
  });

  it('removes selected volumes and reloads', async () => {
    const { $scope, $state, Notifications, VolumeService } = buildController({
      attached: [{ Name: 'vol1', NodeName: 'n1' }],
      dangling: [],
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    await $scope.removeAction([...$scope.volumes]);
    expect(VolumeService.remove).toHaveBeenCalledWith('vol1', 'n1');
    expect(Notifications.success).toHaveBeenCalledWith(
      'Volume successfully removed',
      'vol1'
    );
    expect($scope.volumes).toEqual([]);
    expect($state.reload).toHaveBeenCalled();
  });

  it('notifies when removing a volume fails', async () => {
    const err = new Error('rm failed');
    const { $scope, Notifications, VolumeService } = buildController({
      attached: [{ Name: 'vol1', NodeName: '' }],
      dangling: [],
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    VolumeService.remove.mockRejectedValueOnce(err);
    await $scope.removeAction([...$scope.volumes]);
    expect(Notifications.error).toHaveBeenCalledWith(
      'Failure',
      err,
      'Unable to remove volume'
    );
  });
});
