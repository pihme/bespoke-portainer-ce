import { beforeEach, describe, expect, it, vi } from 'vitest';

const { controllerState, angularMock } = vi.hoisted(() => {
  const controllerState = { ctor: null };
  const moduleApi = {
    controller: vi.fn((_name, depsOrFn) => {
      controllerState.ctor = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
  };
  const angularMock = {
    module: vi.fn(() => moduleApi),
    isDefined: (v) => v !== undefined && v !== null,
  };
  globalThis.angular = angularMock;
  return { controllerState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
  isDefined: angularMock.isDefined,
}));

vi.mock('moment', () => {
  const momentFn = (input) => ({
    unix: () => (input ? 1700000000 : 0),
  });
  momentFn.unix = (n) => n;
  return { default: momentFn };
});

await import('./containerLogsController.js');

function deferred() {
  let resolve;
  let reject;
  const p = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  p.resolve = resolve;
  p.reject = reject;
  return p;
}

function flush() {
  return Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve());
}

function buildController(options = {}) {
  const {
    containerId = 'ctr-1',
    nodeName = 'node-a',
    endpoint = { Id: 3, Name: 'local' },
    container = {
      Id: containerId,
      Config: { Tty: false },
      HostConfig: { LogConfig: { Type: 'json-file' } },
    },
    containerError = null,
    logsResult = 'line1\nline2',
    logsError = null,
  } = options;

  const intervalHandles = [];
  const $interval = vi.fn((fn, ms) => {
    const handle = { fn, ms, cancelled: false };
    intervalHandles.push(handle);
    return handle;
  });
  $interval.cancel = vi.fn((handle) => {
    if (handle) handle.cancelled = true;
  });

  const $scope = {
    $on: vi.fn((event, handler) => {
      $scope.__handlers = $scope.__handlers || {};
      $scope.__handlers[event] = handler;
    }),
  };

  const transitionParams = { id: containerId, nodeName };
  const $transition$ = { params: () => transitionParams };

  const containerPromise = deferred();
  let logsPromise = deferred();

  const ContainerService = {
    container: vi.fn(() => containerPromise),
    logs: vi.fn(() => {
      logsPromise = deferred();
      return logsPromise;
    }),
  };

  const Notifications = {
    error: vi.fn(),
  };

  const HttpRequestHelper = {
    setPortainerAgentTargetHeader: vi.fn(),
  };

  controllerState.ctor(
    $scope,
    $transition$,
    $interval,
    ContainerService,
    Notifications,
    HttpRequestHelper,
    endpoint
  );

  async function settleContainer() {
    if (containerError) {
      containerPromise.reject(containerError);
    } else {
      containerPromise.resolve(container);
    }
    await containerPromise.catch(() => undefined);
    await flush();
  }

  async function settleLogs(result = logsResult, error = logsError) {
    if (error) {
      logsPromise.reject(error);
    } else {
      logsPromise.resolve(result);
    }
    await logsPromise.catch(() => undefined);
    await flush();
  }

  return {
    $scope,
    $interval,
    intervalHandles,
    ContainerService,
    Notifications,
    HttpRequestHelper,
    settleContainer,
    settleLogs,
    getLogsPromise: () => logsPromise,
  };
}

describe('REQ-CTR-10 ContainerLogsController local logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts polling when logs are enabled and sets no agent target (REQ-TAI-007)', async () => {
    const ctx = buildController();
    expect(ctx.HttpRequestHelper.setPortainerAgentTargetHeader).not.toHaveBeenCalled();
    expect(ctx.ContainerService.container).toHaveBeenCalledWith(3, 'ctr-1');

    await ctx.settleContainer();
    expect(ctx.$scope.logsEnabled).toBe(true);
    expect(ctx.ContainerService.logs).toHaveBeenCalled();

    await ctx.settleLogs('hello logs');
    expect(ctx.$scope.logs).toBe('hello logs');
    expect(ctx.$interval).toHaveBeenCalled();
    expect(ctx.$scope.repeater).toBeTruthy();
  });

  it('skips polling when the log driver is none', async () => {
    const ctx = buildController({
      container: {
        Id: 'ctr-1',
        Config: { Tty: false },
        HostConfig: { LogConfig: { Type: 'none' } },
      },
    });
    await ctx.settleContainer();
    expect(ctx.$scope.logsEnabled).toBe(false);
    expect(ctx.ContainerService.logs).not.toHaveBeenCalled();
  });

  it('notifies when container inspect fails', async () => {
    const err = new Error('inspect failed');
    const ctx = buildController({ containerError: err });
    await ctx.settleContainer();
    expect(ctx.Notifications.error).toHaveBeenCalledWith(
      'Failure',
      err,
      'Unable to retrieve container information'
    );
  });

  it('stops the repeater and notifies when the first logs fetch fails', async () => {
    const err = new Error('logs failed');
    const ctx = buildController({ logsError: err });
    await ctx.settleContainer();
    await ctx.settleLogs(undefined, err);
    expect(ctx.Notifications.error).toHaveBeenCalledWith(
      'Failure',
      err,
      'Unable to retrieve container logs'
    );
  });

  it('stops and restarts polling via changeLogCollection', async () => {
    const ctx = buildController();
    await ctx.settleContainer();
    await ctx.settleLogs('first');

    ctx.$scope.changeLogCollection(false);
    expect(ctx.$interval.cancel).toHaveBeenCalled();

    ctx.$scope.changeLogCollection(true);
    expect(ctx.$interval).toHaveBeenCalledTimes(2);
  });

  it('cancels the repeater on $destroy', async () => {
    const ctx = buildController();
    await ctx.settleContainer();
    await ctx.settleLogs('first');
    ctx.$scope.__handlers.$destroy();
    expect(ctx.$interval.cancel).toHaveBeenCalled();
  });

  it('refreshes logs on the interval tick and stops on tick failure', async () => {
    const ctx = buildController();
    await ctx.settleContainer();
    await ctx.settleLogs('first');

    const handle = ctx.intervalHandles[0];
    handle.fn();
    expect(ctx.ContainerService.logs.mock.calls.length).toBeGreaterThan(1);
    const err = new Error('tick fail');
    await ctx.settleLogs(undefined, err);
    await flush();
    expect(ctx.Notifications.error).toHaveBeenCalledWith(
      'Failure',
      err,
      'Unable to retrieve container logs'
    );
  });

  it('passes displayTimestamps into the logs request', async () => {
    const ctx = buildController();
    ctx.$scope.state.displayTimestamps = true;
    await ctx.settleContainer();
    await ctx.settleLogs('ts');
    const call = ctx.ContainerService.logs.mock.calls[0];
    // displayTimestamps ? 1 : 0 is the 5th arg (index 4)
    expect(call[4]).toBe(1);
  });

  it('uses skipHeaders based on TTY when starting polling', async () => {
    const ctx = buildController({
      container: {
        Id: 'ctr-tty',
        Config: { Tty: true },
        HostConfig: { LogConfig: { Type: 'json-file' } },
      },
    });
    await ctx.settleContainer();
    await ctx.settleLogs('tty');
    const call = ctx.ContainerService.logs.mock.calls[0];
    // last arg skipHeaders = !Tty => false
    expect(call[call.length - 1]).toBe(false);
  });
});
