import { beforeEach, describe, expect, it, vi } from 'vitest';

const { controllerState, angularMock } = vi.hoisted(() => {
  const controllerState = { ctor: null };
  const moduleApi = {
    controller: vi.fn((_name, depsOrFn) => {
      controllerState.ctor = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
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

await import('./stacksController.js');

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
    isAdmin = true,
    allowStackManagementForRegularUsers = true,
    provider = 'DOCKER_STANDALONE',
    role = 'MANAGER',
    stacksResult = [{ Name: 'web', External: false }],
    stacksError = null,
  } = options;

  const $scope = {
    applicationState: {
      endpoint: {
        mode: { provider, role },
      },
    },
    stacks: [],
  };
  const $state = { reload: vi.fn(), go: vi.fn() };
  const Notifications = { success: vi.fn(), error: vi.fn() };
  const stacksPromise = deferred();
  const StackService = {
    stacks: vi.fn(() => stacksPromise),
    remove: vi.fn(() => Promise.resolve()),
  };
  const Authentication = {
    isAdmin: vi.fn(() => isAdmin),
  };
  const endpoint = {
    Id: 3,
    SecuritySettings: { allowStackManagementForRegularUsers },
  };

  controllerState.ctor($scope, $state, Notifications, StackService, Authentication, endpoint);

  if (stacksError) {
    stacksPromise.reject(stacksError);
  } else {
    stacksPromise.resolve(stacksResult);
  }

  return { $scope, $state, Notifications, StackService, Authentication, endpoint, stacksPromise };
}

describe('REQ-STK-01 StacksController local Compose stacks list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers StacksController on portainer.app', () => {
    expect(controllerState.ctor).toEqual(expect.any(Function));
  });

  it('loads stacks for a local standalone Docker endpoint when the user can manage stacks', async () => {
    const { $scope, $state, StackService, Authentication } = buildController({
      isAdmin: true,
      provider: 'DOCKER_STANDALONE',
      stacksResult: [{ Name: 'web', External: false }],
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(Authentication.isAdmin).toHaveBeenCalled();
    expect($scope.createEnabled).toBe(true);
    expect($state.go).not.toHaveBeenCalled();
    expect(StackService.stacks).toHaveBeenCalledWith(true, false, 3, true);
    expect($scope.stacks).toEqual([{ Name: 'web', External: false }]);
  });

  it('redirects regular users to the dashboard when stack management is disabled', async () => {
    const { $scope, $state, StackService } = buildController({
      isAdmin: false,
      allowStackManagementForRegularUsers: false,
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect($scope.createEnabled).toBe(false);
    expect($state.go).toHaveBeenCalledWith('docker.dashboard');
    expect(StackService.stacks).toHaveBeenCalled();
  });

  it('clears stacks and notifies when listing fails', async () => {
    const err = new Error('list failed');
    const { $scope, Notifications } = buildController({ stacksError: err });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect($scope.stacks).toEqual([]);
    expect(Notifications.error).toHaveBeenCalledWith(
      'Failure',
      err,
      'Unable to retrieve stacks'
    );
  });

  it('removes selected stacks in batches and reloads', async () => {
    const { $scope, $state, Notifications, StackService } = buildController({
      stacksResult: [
        { Name: 'web', External: false },
        { Name: 'api', External: true },
      ],
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const selected = [...$scope.stacks];
    await $scope.removeAction(selected);

    expect(StackService.remove).toHaveBeenCalledTimes(2);
    expect(StackService.remove).toHaveBeenCalledWith(selected[0], false, 3);
    expect(StackService.remove).toHaveBeenCalledWith(selected[1], true, 3);
    expect(Notifications.success).toHaveBeenCalledWith(
      'Stack successfully removed',
      'web'
    );
    expect(Notifications.success).toHaveBeenCalledWith(
      'Stack successfully removed',
      'api'
    );
    expect($scope.stacks).toEqual([]);
    expect($state.reload).toHaveBeenCalled();
  });

  it('notifies when removing a stack fails but still reloads', async () => {
    const err = new Error('remove failed');
    const { $scope, $state, Notifications, StackService } = buildController({
      stacksResult: [{ Name: 'web', External: false }],
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    StackService.remove.mockRejectedValueOnce(err);
    await $scope.removeAction([...$scope.stacks]);

    expect(Notifications.error).toHaveBeenCalledWith(
      'Failure',
      err,
      'Unable to remove stack web'
    );
    expect($state.reload).toHaveBeenCalled();
  });

  it('asks StackService for orphaned stacks only for admins on local Docker', async () => {
    const { StackService } = buildController({
      isAdmin: false,
      allowStackManagementForRegularUsers: true,
      provider: 'DOCKER_STANDALONE',
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(StackService.stacks).toHaveBeenCalledWith(true, false, 3, false);
  });
});
