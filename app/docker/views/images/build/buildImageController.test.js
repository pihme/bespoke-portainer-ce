import { beforeEach, describe, expect, it, vi } from 'vitest';

const { controllerState, angularMock, confirmWebEditorDiscardMock, editorOpt, uploadOpt, urlOpt } = vi.hoisted(() => {
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
  return {
    controllerState,
    angularMock,
    confirmWebEditorDiscardMock: vi.fn(),
    editorOpt: { id: 'method_editor', value: 'editor', label: 'Web editor' },
    uploadOpt: { id: 'method_upload', value: 'upload', label: 'Upload' },
    urlOpt: { id: 'method_url', value: 'url', label: 'URL' },
  };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('@@/modals/confirm', () => ({
  confirmWebEditorDiscard: confirmWebEditorDiscardMock,
}));

vi.mock('@@/BoxSelector/common-options/build-methods', () => ({
  editor: editorOpt,
  upload: uploadOpt,
  url: urlOpt,
}));

await import('./buildImageController.js');

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
    endpoint = { Id: 3, Name: 'local' },
    buildResult = { buildLogs: ['Step 1/1 : FROM alpine', 'Successfully built'], hasError: false },
    buildError = null,
  } = options;

  const destroyHandlers = [];
  const $scope = {
    $evalAsync: (fn) => fn(),
    $on: vi.fn((event, handler) => {
      if (event === '$destroy') {
        destroyHandlers.push(handler);
      }
    }),
  };
  const $window = {};
  const Notifications = {
    success: vi.fn(),
    error: vi.fn(),
  };
  const HttpRequestHelper = {
    setPortainerAgentTargetHeader: vi.fn(),
  };

  const uploadPromise = deferred();
  const urlPromise = deferred();
  const contentPromise = deferred();
  const contentAndFilesPromise = deferred();

  const BuildService = {
    buildImageFromUpload: vi.fn(() => uploadPromise),
    buildImageFromURL: vi.fn(() => urlPromise),
    buildImageFromDockerfileContent: vi.fn(() => contentPromise),
    buildImageFromDockerfileContentAndFiles: vi.fn(() => contentAndFilesPromise),
  };

  const $async = (fn, ...args) => Promise.resolve().then(() => fn(...args));

  const controllerInstance = {};
  controllerState.ctor.call(
    controllerInstance,
    $scope,
    $async,
    $window,
    BuildService,
    Notifications,
    HttpRequestHelper,
    endpoint
  );

  async function settleBuild(which) {
    const map = {
      upload: uploadPromise,
      url: urlPromise,
      content: contentPromise,
      contentAndFiles: contentAndFilesPromise,
    };
    const promise = map[which];
    if (buildError) {
      promise.reject(buildError);
    } else {
      promise.resolve(buildResult);
    }
    await promise.catch(() => undefined);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  return {
    $scope,
    $window,
    Notifications,
    HttpRequestHelper,
    BuildService,
    controllerInstance,
    destroyHandlers,
    uploadPromise,
    urlPromise,
    contentPromise,
    contentAndFilesPromise,
    buildResult,
    buildError,
    settleBuild,
  };
}

describe('REQ-IMG-03 BuildImageController local Docker image build form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmWebEditorDiscardMock.mockReset();
  });

  it('initializes build options, editor defaults, and a single empty image name', () => {
    const ctx = buildController();

    expect(ctx.$scope.endpoint).toEqual({ Id: 3, Name: 'local' });
    expect(ctx.$scope.options).toEqual([editorOpt, uploadOpt, urlOpt]);
    expect(ctx.$scope.state).toEqual({
      BuildType: 'editor',
      actionInProgress: false,
      activeTab: 0,
      isEditorDirty: false,
    });
    expect(ctx.$scope.formValues).toEqual({
      ImageNames: [{ Name: '', Valid: false, Unique: true }],
      UploadFile: null,
      DockerFileContent: '',
      AdditionalFiles: [],
      URL: '',
      Path: 'Dockerfile',
      NodeName: null,
    });
    expect(ctx.$scope.$on).toHaveBeenCalledWith('$destroy', expect.any(Function));
    expect(typeof ctx.$window.onbeforeunload).toBe('function');
  });

  it('switches build type via onChangeBuildType', () => {
    const ctx = buildController();

    ctx.$scope.onChangeBuildType('upload');
    expect(ctx.$scope.state.BuildType).toBe('upload');

    ctx.$scope.onChangeBuildType('url');
    expect(ctx.$scope.state.BuildType).toBe('url');

    ctx.$scope.onChangeBuildType('editor');
    expect(ctx.$scope.state.BuildType).toBe('editor');
  });

  it('warns on beforeunload only for a dirty web editor with content', () => {
    const ctx = buildController();

    expect(ctx.$window.onbeforeunload()).toBeUndefined();

    ctx.$scope.formValues.DockerFileContent = 'FROM alpine';
    ctx.$scope.state.isEditorDirty = true;
    expect(ctx.$window.onbeforeunload()).toBe('');

    ctx.$scope.state.BuildType = 'upload';
    expect(ctx.$window.onbeforeunload()).toBeUndefined();

    ctx.$scope.state.BuildType = 'editor';
    ctx.$scope.state.isEditorDirty = false;
    expect(ctx.$window.onbeforeunload()).toBeUndefined();
  });

  it('clears the dirty editor flag on $destroy', () => {
    const ctx = buildController();
    ctx.$scope.state.isEditorDirty = true;
    expect(ctx.destroyHandlers).toHaveLength(1);
    ctx.destroyHandlers[0]();
    expect(ctx.$scope.state.isEditorDirty).toBe(false);
  });

  it('validates image names for format and uniqueness', () => {
    const ctx = buildController();

    ctx.$scope.formValues.ImageNames[0].Name = '';
    ctx.$scope.checkName(0);
    expect(ctx.$scope.formValues.ImageNames[0]).toMatchObject({ Valid: false, Unique: true });

    ctx.$scope.formValues.ImageNames[0].Name = 'MyImage';
    ctx.$scope.checkName(0);
    expect(ctx.$scope.formValues.ImageNames[0]).toMatchObject({ Valid: false, Unique: true });

    ctx.$scope.formValues.ImageNames[0].Name = 'my-image:latest';
    ctx.$scope.checkName(0);
    expect(ctx.$scope.formValues.ImageNames[0]).toMatchObject({ Valid: true, Unique: true });

    ctx.$scope.formValues.ImageNames[0].Name = 'registry.example.com:5000/team/my-image:1.0';
    ctx.$scope.checkName(0);
    expect(ctx.$scope.formValues.ImageNames[0]).toMatchObject({ Valid: true, Unique: true });

    ctx.$scope.addImageName();
    ctx.$scope.formValues.ImageNames[1].Name = 'my-image:latest';
    ctx.$scope.formValues.ImageNames[0].Name = 'my-image:latest';
    ctx.$scope.checkName(1);
    expect(ctx.$scope.formValues.ImageNames[1]).toMatchObject({ Valid: false, Unique: false });
  });

  it('adds and removes image names and rechecks remaining names', () => {
    const ctx = buildController();

    ctx.$scope.formValues.ImageNames[0].Name = 'alpha:1';
    ctx.$scope.checkName(0);
    ctx.$scope.addImageName();
    expect(ctx.$scope.formValues.ImageNames).toHaveLength(2);
    expect(ctx.$scope.formValues.ImageNames[1]).toEqual({ Name: '', Valid: false, Unique: true });

    ctx.$scope.formValues.ImageNames[1].Name = 'alpha:1';
    ctx.$scope.checkName(1);
    expect(ctx.$scope.formValues.ImageNames[1].Unique).toBe(false);

    ctx.$scope.removeImageName(0);
    expect(ctx.$scope.formValues.ImageNames).toHaveLength(1);
    expect(ctx.$scope.formValues.ImageNames[0].Name).toBe('alpha:1');
    expect(ctx.$scope.formValues.ImageNames[0]).toMatchObject({ Valid: true, Unique: true });
  });

  it('reports validImageNames only when every name entry is Valid', () => {
    const ctx = buildController();

    expect(ctx.$scope.validImageNames()).toBe(false);

    ctx.$scope.formValues.ImageNames[0].Valid = true;
    expect(ctx.$scope.validImageNames()).toBe(true);

    ctx.$scope.addImageName();
    expect(ctx.$scope.validImageNames()).toBe(false);

    ctx.$scope.formValues.ImageNames = [];
    expect(ctx.$scope.validImageNames()).toBe(false);
  });

  it('updates Dockerfile content and marks the editor dirty', () => {
    const ctx = buildController();

    ctx.$scope.editorUpdate('FROM alpine\nRUN echo hi');
    expect(ctx.$scope.formValues.DockerFileContent).toBe('FROM alpine\nRUN echo hi');
    expect(ctx.$scope.state.isEditorDirty).toBe(true);
  });

  it('stores additional files selected for the editor build', () => {
    const ctx = buildController();
    const files = [{ name: 'config.json' }, { name: 'script.sh' }];

    ctx.$scope.selectAdditionalFiles(files);
    expect(ctx.$scope.formValues.AdditionalFiles).toBe(files);
  });

  it('stops an editor build when Dockerfile content is empty', async () => {
    const ctx = buildController();
    ctx.$scope.state.BuildType = 'editor';
    ctx.$scope.formValues.DockerFileContent = '';

    await ctx.$scope.buildImage();

    expect(ctx.$scope.state.formValidationError).toBe('Dockerfile content must not be empty');
    expect(ctx.BuildService.buildImageFromDockerfileContent).not.toHaveBeenCalled();
    expect(ctx.$scope.state.actionInProgress).toBe(false);
  });

  it('builds from upload and shows success with logs', async () => {
    const file = { name: 'context.tar' };
    const ctx = buildController({
      buildResult: { buildLogs: ['uploaded'], hasError: false },
    });
    ctx.$scope.state.BuildType = 'upload';
    ctx.$scope.formValues.UploadFile = file;
    ctx.$scope.formValues.Path = 'docker/Dockerfile';
    ctx.$scope.formValues.NodeName = 'agent-1';
    ctx.$scope.formValues.ImageNames = [
      { Name: 'app:1', Valid: true, Unique: true },
      { Name: '', Valid: false, Unique: true },
      { Name: 'app:latest', Valid: true, Unique: true },
    ];

    const pending = ctx.$scope.buildImage();
    await Promise.resolve();
    expect(ctx.$scope.state.actionInProgress).toBe(true);
    expect(ctx.HttpRequestHelper.setPortainerAgentTargetHeader).toHaveBeenCalledWith('agent-1');
    expect(ctx.BuildService.buildImageFromUpload).toHaveBeenCalledWith(3, ['app:1', 'app:latest'], file, 'docker/Dockerfile');

    await ctx.settleBuild('upload');
    await pending;

    expect(ctx.$scope.buildLogs).toEqual(['uploaded']);
    expect(ctx.$scope.state.activeTab).toBe(1);
    expect(ctx.Notifications.success).toHaveBeenCalledWith('Image successfully built');
    expect(ctx.$scope.state.isEditorDirty).toBe(false);
    expect(ctx.$scope.state.actionInProgress).toBe(false);
  });

  it('builds from a remote Dockerfile URL on the local engine', async () => {
    const ctx = buildController({
      buildResult: { buildLogs: ['from-url'], hasError: false },
    });
    ctx.$scope.state.BuildType = 'url';
    ctx.$scope.formValues.URL = 'https://example.com/Dockerfile';
    ctx.$scope.formValues.Path = 'Dockerfile';
    ctx.$scope.formValues.ImageNames = [{ Name: 'url-img:1', Valid: true, Unique: true }];

    const pending = ctx.$scope.buildImage();
    await Promise.resolve();
    expect(ctx.BuildService.buildImageFromURL).toHaveBeenCalledWith(
      3,
      ['url-img:1'],
      'https://example.com/Dockerfile',
      'Dockerfile'
    );

    await ctx.settleBuild('url');
    await pending;

    expect(ctx.$scope.buildLogs).toEqual(['from-url']);
    expect(ctx.Notifications.success).toHaveBeenCalledWith('Image successfully built');
  });

  it('builds from editor Dockerfile content without additional files', async () => {
    const ctx = buildController();
    ctx.$scope.state.BuildType = 'editor';
    ctx.$scope.formValues.DockerFileContent = 'FROM alpine';
    ctx.$scope.state.isEditorDirty = true;
    ctx.$scope.formValues.AdditionalFiles = [];
    ctx.$scope.formValues.ImageNames = [{ Name: 'editor-img:1', Valid: true, Unique: true }];

    const pending = ctx.$scope.buildImage();
    await Promise.resolve();
    expect(ctx.BuildService.buildImageFromDockerfileContent).toHaveBeenCalledWith(3, ['editor-img:1'], 'FROM alpine');

    await ctx.settleBuild('content');
    await pending;

    expect(ctx.Notifications.success).toHaveBeenCalledWith('Image successfully built');
    expect(ctx.$scope.state.isEditorDirty).toBe(false);
  });

  it('builds from editor content plus additional files', async () => {
    const files = [{ name: 'extra.txt' }];
    const ctx = buildController({
      buildResult: { buildLogs: ['with-files'], hasError: false },
    });
    ctx.$scope.state.BuildType = 'editor';
    ctx.$scope.formValues.DockerFileContent = 'FROM busybox';
    ctx.$scope.formValues.AdditionalFiles = files;
    ctx.$scope.formValues.ImageNames = [{ Name: 'bundle:1', Valid: true, Unique: true }];

    const pending = ctx.$scope.buildImage();
    await Promise.resolve();
    expect(ctx.BuildService.buildImageFromDockerfileContentAndFiles).toHaveBeenCalledWith(
      3,
      ['bundle:1'],
      'FROM busybox',
      files
    );

    await ctx.settleBuild('contentAndFiles');
    await pending;

    expect(ctx.$scope.buildLogs).toEqual(['with-files']);
    expect(ctx.Notifications.success).toHaveBeenCalledWith('Image successfully built');
  });

  it('notifies with build-log guidance when the build response hasError', async () => {
    const ctx = buildController({
      buildResult: { buildLogs: ['ERROR: fail'], hasError: true },
    });
    ctx.$scope.state.BuildType = 'editor';
    ctx.$scope.formValues.DockerFileContent = 'FROM alpine';
    ctx.$scope.state.isEditorDirty = true;
    ctx.$scope.formValues.ImageNames = [{ Name: 'bad:1', Valid: true, Unique: true }];

    const pending = ctx.$scope.buildImage();
    await Promise.resolve();
    await ctx.settleBuild('content');
    await pending;

    expect(ctx.Notifications.error).toHaveBeenCalledWith('An error occurred during build', {
      msg: 'Please check build logs output',
    });
    expect(ctx.Notifications.success).not.toHaveBeenCalled();
    expect(ctx.$scope.state.isEditorDirty).toBe(true);
    expect(ctx.$scope.state.activeTab).toBe(1);
    expect(ctx.$scope.buildLogs).toEqual(['ERROR: fail']);
  });

  it('notifies failure when BuildService rejects', async () => {
    const err = new Error('engine down');
    const ctx = buildController({ buildError: err });
    ctx.$scope.state.BuildType = 'upload';
    ctx.$scope.formValues.UploadFile = { name: 'ctx.tar' };
    ctx.$scope.formValues.ImageNames = [{ Name: 'x:1', Valid: true, Unique: true }];

    const pending = ctx.$scope.buildImage();
    await Promise.resolve();
    await ctx.settleBuild('upload');
    await pending;

    expect(ctx.Notifications.error).toHaveBeenCalledWith('Failure', err, 'Unable to build image');
    expect(ctx.$scope.state.actionInProgress).toBe(false);
  });

  it('asks to discard dirty editor content before exit and skips when clean', async () => {
    const ctx = buildController();
    confirmWebEditorDiscardMock.mockResolvedValue(true);

    await expect(ctx.controllerInstance.uiCanExit()).resolves.toBeUndefined();
    expect(confirmWebEditorDiscardMock).not.toHaveBeenCalled();

    ctx.$scope.formValues.DockerFileContent = 'FROM alpine';
    ctx.$scope.state.isEditorDirty = true;
    await expect(ctx.controllerInstance.uiCanExit()).resolves.toBe(true);
    expect(confirmWebEditorDiscardMock).toHaveBeenCalledTimes(1);

    ctx.$scope.state.BuildType = 'url';
    confirmWebEditorDiscardMock.mockClear();
    await expect(ctx.controllerInstance.uiCanExit()).resolves.toBeUndefined();
    expect(confirmWebEditorDiscardMock).not.toHaveBeenCalled();
  });
});
