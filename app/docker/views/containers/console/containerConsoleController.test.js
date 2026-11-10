import { beforeEach, describe, expect, it, vi } from 'vitest';

const LABEL_PREFIX = 'io.portainer.commands.';

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
  };
  globalThis.angular = angularMock;
  return { controllerState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('@/portainer/helpers/pathHelper', () => ({
  baseHref: () => '/',
}));

vi.mock('@@/Terminal/Terminal', () => ({
  isLinuxTerminalCommand: (command) => {
    const shells = ['bash', 'sh', 'zsh', 'ash', 'dash', 'fish', 'csh', 'ksh'];
    const basename = String(command).split('/').pop() ?? command;
    return shells.includes(basename);
  },
  LINUX_SHELL_INIT_COMMANDS: ['stty cols 80 rows 24', 'clear'],
}));

await import('./containerConsoleController.js');

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

function flush() {
  return Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve());
}

function runningContainer(overrides = {}) {
  return {
    Id: 'ctr-1',
    Image: 'sha256:img',
    State: { Running: true },
    Config: {
      Labels: {
        [`${LABEL_PREFIX}shell`]: '/bin/bash',
        'com.docker.compose.project': 'demo',
        [`${LABEL_PREFIX}python`]: 'python3',
      },
    },
    ...overrides,
  };
}

function buildController(options = {}) {
  const {
    containerId = 'ctr-1',
    endpointId = 7,
    nodeName,
    endpoint = { Id: 3, Name: 'local' },
    container = runningContainer(),
    containerError = null,
    image = { Os: 'linux' },
    imageError = null,
    execError = null,
  } = options;

  const $scope = {
    $evalAsync: (fn) => fn(),
    $on: vi.fn((event, handler) => {
      $scope.__handlers = $scope.__handlers || {};
      $scope.__handlers[event] = handler;
    }),
  };

  const $state = {
    params: { endpointId },
    go: vi.fn(),
  };

  const transitionParams = { id: containerId, nodeName };
  const $transition$ = {
    params: () => transitionParams,
  };

  const containerPromise = deferred();
  const imagePromise = deferred();
  const execPromise = deferred();

  const ContainerService = {
    container: vi.fn(() => containerPromise),
    createExec: vi.fn(() => execPromise),
    resizeTTY: vi.fn(() => Promise.resolve()),
  };

  const ExecService = {
    resizeTTY: vi.fn(() => Promise.resolve()),
  };

  const ImageService = {
    image: vi.fn(() => imagePromise),
  };

  const Notifications = {
    error: vi.fn(),
    success: vi.fn(),
  };

  const HttpRequestHelper = {
    setPortainerAgentTargetHeader: vi.fn(),
  };

  controllerState.ctor(
    $scope,
    $state,
    $transition$,
    ContainerService,
    ExecService,
    ImageService,
    Notifications,
    HttpRequestHelper,
    LABEL_PREFIX,
    endpoint
  );

  async function settleInit() {
    const initDone = $scope.initView();
    if (containerError) {
      containerPromise.reject(containerError);
    } else {
      containerPromise.resolve(container);
    }
    await containerPromise.catch(() => undefined);
    await flush();

    if (!containerError) {
      if (imageError) {
        imagePromise.reject(imageError);
      } else {
        imagePromise.resolve(image);
      }
      await imagePromise.catch(() => undefined);
      await flush();
    }
    await initDone;
    await flush();
  }

  async function settleExec(result = { Id: 'exec-99' }, error = execError) {
    if (error) {
      execPromise.reject(error);
    } else {
      execPromise.resolve(result);
    }
    await execPromise.catch(() => undefined);
    await flush();
  }

  return {
    $scope,
    $state,
    ContainerService,
    ExecService,
    ImageService,
    Notifications,
    HttpRequestHelper,
    containerPromise,
    imagePromise,
    execPromise,
    settleInit,
    settleExec,
  };
}

describe('REQ-CTR-12 ContainerConsoleController local exec and attach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts disconnected with empty form and shell state', () => {
    const { $scope } = buildController();

    expect($scope.loaded).toBe(false);
    expect($scope.state).toBe($scope.states.disconnected);
    expect($scope.states).toEqual({ disconnected: 0, connecting: 1, connected: 2 });
    expect($scope.formValues).toEqual({});
    expect($scope.containerCommands).toEqual([]);
    expect($scope.shellUrl).toBe('');
    expect($scope.shellConnect).toBe(false);
    expect($scope.onShellResize).toBeNull();
    expect($scope.shellInitCommands).toBeNull();
    expect($scope.$on).toHaveBeenCalledWith('$destroy', expect.any(Function));
  });

  it('loads a linux container, defaults command to bash, and maps console label commands', async () => {
    const ctx = buildController();
    await ctx.settleInit();

    expect(ctx.HttpRequestHelper.setPortainerAgentTargetHeader).not.toHaveBeenCalled();
    expect(ctx.ContainerService.container).toHaveBeenCalledWith(3, 'ctr-1');
    expect(ctx.ImageService.image).toHaveBeenCalledWith('sha256:img');
    expect(ctx.$scope.container).toMatchObject({ Id: 'ctr-1' });
    expect(ctx.$scope.imageOS).toBe('linux');
    expect(ctx.$scope.formValues.command).toBe('bash');
    expect(ctx.$scope.containerCommands).toEqual([
      { title: 'shell', command: '/bin/bash' },
      { title: 'python', command: 'python3' },
    ]);
    expect(ctx.$scope.loaded).toBe(true);
  });

  it('defaults the command to powershell for a windows image', async () => {
    const ctx = buildController({
      image: { Os: 'windows' },
      container: runningContainer({
        Id: 'ctr-win',
        Image: 'mcr.microsoft.com/windows',
        Config: { Labels: {} },
      }),
    });
    await ctx.settleInit();

    expect(ctx.$scope.imageOS).toBe('windows');
    expect(ctx.$scope.formValues.command).toBe('powershell');
    expect(ctx.$scope.containerCommands).toEqual([]);
    expect(ctx.$scope.loaded).toBe(true);
  });

  it('notifies when container details cannot be retrieved on init', async () => {
    const err = new Error('inspect failed');
    const ctx = buildController({ containerError: err });
    await ctx.settleInit();

    expect(ctx.Notifications.error).toHaveBeenCalledWith('Error', err, 'Unable to retrieve container details');
    expect(ctx.$scope.loaded).toBe(false);
    expect(ctx.ImageService.image).not.toHaveBeenCalled();
  });

  it('notifies when image details cannot be retrieved on init', async () => {
    const err = new Error('image failed');
    const ctx = buildController({ imageError: err });
    await ctx.settleInit();

    expect(ctx.Notifications.error).toHaveBeenCalledWith('Error', err, 'Unable to retrieve container details');
    expect(ctx.$scope.loaded).toBe(false);
  });

  it('toggles the custom-command form flag', () => {
    const { $scope } = buildController();
    $scope.handleIsCustomCommandChange(true);
    expect($scope.formValues.isCustomCommand).toBe(true);
    $scope.handleIsCustomCommandChange(false);
    expect($scope.formValues.isCustomCommand).toBe(false);
  });

  it('connects an attach session for a running container and builds a websocket URL', async () => {
    const ctx = buildController();
    await ctx.settleInit();

    const attachDetailsPromise = deferred();
    ctx.ContainerService.container.mockImplementation(() => attachDetailsPromise);

    ctx.$scope.connectAttach();
    expect(ctx.$scope.state).toBe(ctx.$scope.states.connecting);

    attachDetailsPromise.resolve({ Id: 'ctr-1', State: { Running: true } });
    await attachDetailsPromise;
    await flush();

    expect(ctx.$scope.shellConnect).toBe(true);
    expect(ctx.$scope.shellUrl).toMatch(/^ws:\/\//);
    expect(ctx.$scope.shellUrl).toContain('api/websocket/attach');
    expect(ctx.$scope.shellUrl).toContain('endpointId=7');
    expect(ctx.$scope.shellUrl).toContain('id=ctr-1');
    expect(ctx.$scope.shellUrl).not.toContain('nodeName=');

    ctx.$scope.onShellResize({ rows: 24, cols: 80 });
    expect(ctx.ContainerService.resizeTTY).toHaveBeenCalledWith(3, 'ctr-1', 80, 24);
  });

  it('disconnects attach when the container is not running', async () => {
    const ctx = buildController();
    await ctx.settleInit();

    const attachDetailsPromise = deferred();
    ctx.ContainerService.container.mockImplementation(() => attachDetailsPromise);

    ctx.$scope.connectAttach();
    attachDetailsPromise.resolve({ Id: 'ctr-1', State: { Running: false } });
    await attachDetailsPromise;
    await flush();

    expect(ctx.Notifications.error).toHaveBeenCalledWith(
      'Failure',
      expect.objectContaining({ State: { Running: false } }),
      'Container ctr-1 is not running!'
    );
    expect(ctx.$scope.state).toBe(ctx.$scope.states.disconnected);
    expect(ctx.$scope.shellConnect).toBe(false);
  });

  it('notifies and disconnects when attach cannot load container details', async () => {
    const err = new Error('attach inspect failed');
    const ctx = buildController();
    await ctx.settleInit();

    const attachDetailsPromise = deferred();
    ctx.ContainerService.container.mockImplementation(() => attachDetailsPromise);

    ctx.$scope.connectAttach();
    attachDetailsPromise.reject(err);
    await attachDetailsPromise.catch(() => undefined);
    await flush();

    expect(ctx.Notifications.error).toHaveBeenCalledWith('Error', err, 'Unable to retrieve container details');
    expect(ctx.$scope.state).toBe(ctx.$scope.states.disconnected);
  });

  it('ignores a second attach connect while already connecting', async () => {
    const ctx = buildController();
    await ctx.settleInit();

    const attachDetailsPromise = deferred();
    ctx.ContainerService.container.mockClear();
    ctx.ContainerService.container.mockImplementation(() => attachDetailsPromise);

    ctx.$scope.connectAttach();
    ctx.$scope.connectAttach();
    expect(ctx.ContainerService.container).toHaveBeenCalledTimes(1);

    attachDetailsPromise.resolve({ Id: 'ctr-1', State: { Running: true } });
    await attachDetailsPromise;
    await flush();
  });

  it('connects an exec session with the selected command and user', async () => {
    const ctx = buildController();
    await ctx.settleInit();

    ctx.$scope.formValues.command = 'bash';
    ctx.$scope.formValues.user = 'root';
    ctx.$scope.formValues.isCustomCommand = false;

    ctx.$scope.connectExec();
    expect(ctx.$scope.state).toBe(ctx.$scope.states.connecting);
    expect(ctx.ContainerService.createExec).toHaveBeenCalledWith(3, 'ctr-1', {
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      User: 'root',
      Cmd: ['bash'],
    });

    await ctx.settleExec({ Id: 'exec-99' });

    expect(ctx.$scope.shellInitCommands).toEqual(['stty cols 80 rows 24', 'clear']);
    expect(ctx.$scope.shellConnect).toBe(true);
    expect(ctx.$scope.shellUrl).toMatch(/^ws:\/\//);
    expect(ctx.$scope.shellUrl).toContain('api/websocket/exec');
    expect(ctx.$scope.shellUrl).toContain('id=exec-99');
    expect(ctx.$scope.shellUrl).toContain('endpointId=7');

    ctx.$scope.onShellResize({ rows: 40, cols: 120 });
    expect(ctx.ExecService.resizeTTY).toHaveBeenCalledWith('exec-99', 120, 40);
  });

  it('uses a custom command string for exec when the custom flag is set', async () => {
    const ctx = buildController();
    await ctx.settleInit();

    ctx.$scope.formValues.isCustomCommand = true;
    ctx.$scope.formValues.customCommand = 'ash -l';
    ctx.$scope.formValues.command = 'bash';
    ctx.$scope.formValues.user = '';

    ctx.$scope.connectExec();
    expect(ctx.ContainerService.createExec).toHaveBeenCalledWith(
      3,
      'ctr-1',
      expect.objectContaining({
        User: '',
        Cmd: ['ash', '-l'],
      })
    );

    await ctx.settleExec({ Id: 'exec-ash' });
    expect(ctx.$scope.shellInitCommands).toEqual(['stty cols 80 rows 24', 'clear']);
  });

  it('skips linux shell init commands for a non-linux exec command', async () => {
    const ctx = buildController({ image: { Os: 'windows' } });
    await ctx.settleInit();

    ctx.$scope.formValues.command = 'powershell';
    ctx.$scope.formValues.isCustomCommand = false;
    ctx.$scope.connectExec();
    await ctx.settleExec({ Id: 'exec-win' });

    expect(ctx.$scope.shellInitCommands).toBeNull();
    expect(ctx.$scope.shellConnect).toBe(true);
  });

  it('notifies and disconnects when createExec fails', async () => {
    const err = new Error('exec denied');
    const ctx = buildController({ execError: err });
    await ctx.settleInit();

    ctx.$scope.formValues.command = 'bash';
    ctx.$scope.connectExec();
    await ctx.settleExec(undefined, err);

    expect(ctx.Notifications.error).toHaveBeenCalledWith('Failure', err, 'Unable to exec into container');
    expect(ctx.$scope.state).toBe(ctx.$scope.states.disconnected);
    expect(ctx.$scope.shellConnect).toBe(false);
  });

  it('ignores a second exec connect while already connecting', async () => {
    const ctx = buildController();
    await ctx.settleInit();

    ctx.$scope.formValues.command = 'bash';
    ctx.$scope.connectExec();
    ctx.$scope.connectExec();
    expect(ctx.ContainerService.createExec).toHaveBeenCalledTimes(1);
    await ctx.settleExec({ Id: 'exec-1' });
  });

  it('updates state from shell connected and disconnected events', () => {
    const { $scope } = buildController();

    $scope.state = $scope.states.connecting;
    $scope.shellConnect = true;
    $scope.onShellStateChange('connected');
    expect($scope.state).toBe($scope.states.connected);

    $scope.onShellStateChange('disconnected');
    expect($scope.state).toBe($scope.states.disconnected);
    expect($scope.shellConnect).toBe(false);
  });

  it('disconnect clears shell connection fields', async () => {
    const ctx = buildController();
    await ctx.settleInit();
    ctx.$scope.formValues.command = 'bash';
    ctx.$scope.connectExec();
    await ctx.settleExec({ Id: 'exec-x' });

    expect(ctx.$scope.shellConnect).toBe(true);
    ctx.$scope.disconnect();
    expect(ctx.$scope.shellConnect).toBe(false);
    expect(ctx.$scope.state).toBe(ctx.$scope.states.disconnected);
    expect(ctx.$scope.onShellResize).toBeNull();
    expect(ctx.$scope.shellInitCommands).toBeNull();
  });

  it('autoconnectAttachView connects when the loaded container is running', async () => {
    const initPromise = deferred();
    const imagePromise = deferred();
    const attachPromise = deferred();

    const $scope = {
      $evalAsync: (fn) => fn(),
      $on: vi.fn(),
    };
    const $state = { params: { endpointId: 7 } };
    const $transition$ = { params: () => ({ id: 'ctr-1' }) };
    let containerCalls = 0;
    const ContainerService = {
      container: vi.fn(() => {
        containerCalls += 1;
        return containerCalls === 1 ? initPromise : attachPromise;
      }),
      createExec: vi.fn(),
      resizeTTY: vi.fn(),
    };
    const ExecService = { resizeTTY: vi.fn() };
    const ImageService = { image: vi.fn(() => imagePromise) };
    const Notifications = { error: vi.fn(), success: vi.fn() };
    const HttpRequestHelper = { setPortainerAgentTargetHeader: vi.fn() };

    controllerState.ctor(
      $scope,
      $state,
      $transition$,
      ContainerService,
      ExecService,
      ImageService,
      Notifications,
      HttpRequestHelper,
      LABEL_PREFIX,
      { Id: 3 }
    );

    const done = $scope.autoconnectAttachView();

    initPromise.resolve(
      runningContainer({
        Config: { Labels: {} },
      })
    );
    await flush();
    imagePromise.resolve({ Os: 'linux' });
    await flush();

    expect($scope.state).toBe($scope.states.connecting);

    attachPromise.resolve({ Id: 'ctr-1', State: { Running: true } });
    await attachPromise;
    await flush();
    await done;

    expect($scope.shellConnect).toBe(true);
    expect($scope.shellUrl).toContain('api/websocket/attach');
  });

  it('autoconnectAttachView does not connect when the container is stopped', async () => {
    const ctx = buildController({
      container: runningContainer({ State: { Running: false }, Config: { Labels: {} } }),
    });

    const done = ctx.$scope.autoconnectAttachView();
    await ctx.settleInit();
    await done;

    expect(ctx.$scope.shellConnect).toBe(false);
    expect(ctx.$scope.state).toBe(ctx.$scope.states.disconnected);
  });

  // REQ-TAI-007: per-node targeting is removed; a nodeName transition param
  // is neither sent as a header nor appended to the shell URL.
  it('REQ-TAI-007 ignores a nodeName on the transition', async () => {
    const ctx = buildController({ nodeName: 'worker-1' });
    await ctx.settleInit();

    expect(ctx.HttpRequestHelper.setPortainerAgentTargetHeader).not.toHaveBeenCalled();

    ctx.$scope.formValues.command = 'bash';
    ctx.$scope.connectExec();
    await ctx.settleExec({ Id: 'exec-node' });

    expect(ctx.$scope.shellUrl).not.toContain('nodeName');
  });

  it('disconnects on $destroy', async () => {
    const ctx = buildController();
    await ctx.settleInit();
    ctx.$scope.formValues.command = 'bash';
    ctx.$scope.connectExec();
    await ctx.settleExec({ Id: 'exec-destroy' });

    expect(ctx.$scope.shellConnect).toBe(true);
    ctx.$scope.__handlers.$destroy();
    expect(ctx.$scope.shellConnect).toBe(false);
    expect(ctx.$scope.state).toBe(ctx.$scope.states.disconnected);
  });

  it('builds a wss URL when the page origin is https', async () => {
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, origin: 'https://portainer.example' },
    });

    try {
      const ctx = buildController();
      await ctx.settleInit();
      ctx.$scope.formValues.command = 'bash';
      ctx.$scope.connectExec();
      await ctx.settleExec({ Id: 'exec-tls' });
      expect(ctx.$scope.shellUrl).toMatch(/^wss:\/\//);
      expect(ctx.$scope.shellUrl).toContain('portainer.example');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: original,
      });
    }
  });
});
