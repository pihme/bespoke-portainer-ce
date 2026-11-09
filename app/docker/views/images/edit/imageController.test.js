import { beforeEach, describe, expect, it, vi } from 'vitest';

const { controllerState, angularMock, confirmDeleteMock, confirmImageExportMock } = vi.hoisted(() => {
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
    confirmDeleteMock: vi.fn(),
    confirmImageExportMock: vi.fn(),
  };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('@@/modals/confirm', () => ({
  confirmDelete: confirmDeleteMock,
}));

vi.mock('@/react/docker/images/common/ConfirmExportModal', () => ({
  confirmImageExport: confirmImageExportMock,
}));

vi.mock('@/docker/models/porImageRegistry', () => ({
  PorImageRegistryModel: function PorImageRegistryModel() {
    this.UseRegistry = true;
    this.Registry = {};
    this.Image = '';
  },
}));

await import('./imageController.js');

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

function makeJqueryStub() {
  const chain = {
    toggleClass: vi.fn(() => chain),
    toggle: vi.fn(() => chain),
    show: vi.fn(() => chain),
    hide: vi.fn(() => chain),
  };
  const $ = vi.fn(() => chain);
  return { $, chain };
}

function buildController(options = {}) {
  const {
    imageId = 'sha256:abc',
    nodeName = 'node-1',
    isAdmin = true,
    image = {
      Id: imageId,
      RepoTags: ['nginx:latest', 'nginx:1.25'],
      Env: ['B=2', 'a=1', 'C=3'],
      NodeName: 'agent-node',
    },
    history = [
      { Id: 'layer-1', Order: 2, CreatedBy: 'RUN echo hi' },
      { Id: 'layer-0', Order: 1, CreatedBy: 'FROM alpine' },
    ],
    imageError = null,
    historyError = null,
    registries = [{ Id: 1, Name: 'Docker Hub' }],
    registriesError = null,
    tagResult = undefined,
    tagError = null,
    deleteResult = undefined,
    deleteError = null,
    downloadResult = new ArrayBuffer(8),
    downloadError = null,
  } = options;

  const { $, chain } = makeJqueryStub();
  globalThis.$ = $;

  const $scope = {};
  const $transition$ = {
    params: vi.fn(() => ({ id: imageId, nodeName })),
  };
  const $state = { go: vi.fn() };
  const Authentication = { isAdmin: vi.fn(() => isAdmin) };
  const Notifications = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  };
  const HttpRequestHelper = {
    setPortainerAgentTargetHeader: vi.fn(),
  };
  const FileSaver = { saveAs: vi.fn() };
  const Blob = vi.fn(function MockBlob(parts, opts) {
    this.parts = parts;
    this.type = opts && opts.type;
  });
  const endpoint = { Id: 7, Name: 'local' };

  const imagePromise = deferred();
  const historyPromise = deferred();
  const tagPromise = deferred();
  const deletePromise = deferred();
  const downloadPromise = deferred();

  const ImageService = {
    image: vi.fn(() => imagePromise),
    history: vi.fn(() => historyPromise),
    tagImage: vi.fn(() => tagPromise),
    deleteImage: vi.fn(() => deletePromise),
    downloadImages: vi.fn(() => downloadPromise),
    pushImage: vi.fn(() => Promise.resolve()),
    pullImage: vi.fn(() => Promise.resolve()),
  };

  const ImageHelper = {
    createImageConfigForContainer: vi.fn(() => ({ repo: 'nginx', tag: 'custom' })),
  };

  const RegistryService = {
    loadRegistriesForDropdown: vi.fn(() =>
      registriesError ? Promise.reject(registriesError) : Promise.resolve(registries)
    ),
  };

  const RegistryModalService = {
    registryModal: vi.fn(() => Promise.resolve(null)),
  };

  const $async = (fn, ...args) => Promise.resolve().then(() => fn(...args));

  const $q = {
    all: (map) => {
      const keys = Object.keys(map);
      return Promise.all(keys.map((k) => map[k])).then((values) => {
        const out = {};
        keys.forEach((k, i) => {
          out[k] = values[i];
        });
        return out;
      });
    },
  };

  controllerState.ctor(
    $async,
    $q,
    $scope,
    $transition$,
    $state,
    Authentication,
    ImageService,
    ImageHelper,
    RegistryService,
    Notifications,
    HttpRequestHelper,
    FileSaver,
    Blob,
    endpoint,
    RegistryModalService
  );

  return {
    $scope,
    $state,
    $transition$,
    Authentication,
    ImageService,
    ImageHelper,
    RegistryService,
    Notifications,
    HttpRequestHelper,
    FileSaver,
    Blob,
    RegistryModalService,
    $,
    chain,
    image,
    history,
    imagePromise,
    historyPromise,
    tagPromise,
    deletePromise,
    downloadPromise,
    tagResult,
    tagError,
    deleteResult,
    deleteError,
    downloadResult,
    downloadError,
    imageError,
    historyError,
    async settleInit() {
      if (imageError || historyError) {
        if (imageError) imagePromise.reject(imageError);
        else imagePromise.resolve(image);
        if (historyError) historyPromise.reject(historyError);
        else historyPromise.resolve(history);
      } else {
        imagePromise.resolve(image);
        historyPromise.resolve(history);
      }
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    },
    async settleTag() {
      if (tagError) tagPromise.reject(tagError);
      else tagPromise.resolve(tagResult);
      await tagPromise.catch(() => undefined);
      await Promise.resolve();
      await Promise.resolve();
    },
    async settleDelete() {
      if (deleteError) deletePromise.reject(deleteError);
      else deletePromise.resolve(deleteResult);
      await deletePromise.catch(() => undefined);
      await Promise.resolve();
      await Promise.resolve();
    },
    async settleDownload() {
      if (downloadError) downloadPromise.reject(downloadError);
      else downloadPromise.resolve(downloadResult);
      await downloadPromise.catch(() => undefined);
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe('REQ-IMG-06 ImageController local Docker image details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmDeleteMock.mockReset();
    confirmImageExportMock.mockReset();
  });

  it('initializes scope defaults and loads image details with sorted Env', async () => {
    const ctx = buildController();
    expect(ctx.$scope.endpoint).toEqual({ Id: 7, Name: 'local' });
    expect(ctx.$scope.isAdmin).toBe(true);
    expect(ctx.$scope.formValues.RegistryModel).toMatchObject({
      UseRegistry: true,
      Image: '',
    });
    expect(ctx.$scope.state).toEqual({ exportInProgress: false, pullImageValidity: false });
    expect(ctx.$scope.sortType).toBe('Order');
    expect(ctx.$scope.sortReverse).toBe(false);
    expect(ctx.HttpRequestHelper.setPortainerAgentTargetHeader).toHaveBeenCalledWith('node-1');
    expect(ctx.Authentication.isAdmin).toHaveBeenCalled();

    await ctx.settleInit();

    expect(ctx.RegistryService.loadRegistriesForDropdown).toHaveBeenCalledWith(7);
    expect(ctx.$scope.registries).toEqual([{ Id: 1, Name: 'Docker Hub' }]);
    expect(ctx.ImageService.image).toHaveBeenCalledWith('sha256:abc');
    expect(ctx.ImageService.history).toHaveBeenCalledWith('sha256:abc');
    expect(ctx.$scope.image.Id).toBe('sha256:abc');
    expect(ctx.$scope.image.Env).toEqual(['a=1', 'B=2', 'C=3']);
    expect(ctx.$scope.history).toHaveLength(2);
  });

  it('notifies and returns to the images list when image details fail to load', async () => {
    const err = new Error('boom');
    const ctx = buildController({ imageError: err });
    await ctx.settleInit();

    expect(ctx.Notifications.error).toHaveBeenCalledWith('Failure', err, 'Unable to retrieve image details');
    expect(ctx.$state.go).toHaveBeenCalledWith('docker.images');
  });

  it('orders layers and toggles reverse when the same sort type is chosen again', async () => {
    const ctx = buildController();
    await ctx.settleInit();

    ctx.$scope.order('Size');
    expect(ctx.$scope.sortType).toBe('Size');
    expect(ctx.$scope.sortReverse).toBe(false);

    ctx.$scope.order('Size');
    expect(ctx.$scope.sortType).toBe('Size');
    expect(ctx.$scope.sortReverse).toBe(true);

    ctx.$scope.order('Order');
    expect(ctx.$scope.sortType).toBe('Order');
    expect(ctx.$scope.sortReverse).toBe(false);
  });

  it('toggles layer command expander elements for a layer id', async () => {
    const ctx = buildController();
    await ctx.settleInit();

    ctx.$scope.toggleLayerCommand('layer-1');

    expect(ctx.$).toHaveBeenCalledWith('#layer-command-expanderlayer-1 span');
    expect(ctx.chain.toggleClass).toHaveBeenCalledWith('glyphicon-plus-sign glyphicon-minus-sign');
    expect(ctx.$).toHaveBeenCalledWith('#layer-command-layer-1-short');
    expect(ctx.$).toHaveBeenCalledWith('#layer-command-layer-1-full');
    expect(ctx.chain.toggle).toHaveBeenCalledTimes(2);
  });

  it('records pull image validity from the registry form helper', async () => {
    const ctx = buildController();
    await ctx.settleInit();

    expect(ctx.$scope.setPullImageValidity).toBeTypeOf('function');
    ctx.$scope.setPullImageValidity(true);
    expect(ctx.$scope.state.pullImageValidity).toBe(true);
    ctx.$scope.setPullImageValidity(false);
    expect(ctx.$scope.state.pullImageValidity).toBe(false);
  });

  it('tags the image via ImageHelper and reloads the details page on success', async () => {
    const ctx = buildController();
    await ctx.settleInit();

    ctx.$scope.formValues.RegistryModel.Image = 'nginx';
    ctx.$scope.tagImage();

    expect(ctx.ImageHelper.createImageConfigForContainer).toHaveBeenCalledWith(ctx.$scope.formValues.RegistryModel);
    expect(ctx.ImageService.tagImage).toHaveBeenCalledWith('sha256:abc', 'nginx', 'custom');

    await ctx.settleTag();

    expect(ctx.Notifications.success).toHaveBeenCalledWith('Success', 'Image successfully tagged');
    expect(ctx.$state.go).toHaveBeenCalledWith('docker.images.image', { id: 'sha256:abc' }, { reload: true });
  });

  it('notifies when tagging the image fails', async () => {
    const err = new Error('tag failed');
    const ctx = buildController({ tagError: err });
    await ctx.settleInit();

    ctx.$scope.tagImage();
    await ctx.settleTag();

    expect(ctx.Notifications.error).toHaveBeenCalledWith('Failure', err, 'Unable to tag image');
    expect(ctx.$state.go).not.toHaveBeenCalledWith('docker.images.image', expect.anything(), expect.anything());
  });

  it('does nothing when removeTag confirmation is cancelled', async () => {
    confirmDeleteMock.mockResolvedValue(false);
    const ctx = buildController();
    await ctx.settleInit();

    await ctx.$scope.removeTag('nginx:latest');

    expect(confirmDeleteMock).toHaveBeenCalledWith('Are you sure you want to delete this tag?');
    expect(ctx.ImageService.deleteImage).not.toHaveBeenCalled();
  });

  it('deletes the last tag and returns to the images list', async () => {
    confirmDeleteMock.mockResolvedValue(true);
    const ctx = buildController({
      image: {
        Id: 'sha256:abc',
        RepoTags: ['nginx:latest'],
        Env: [],
        NodeName: 'agent-node',
      },
    });
    await ctx.settleInit();

    const removePromise = ctx.$scope.removeTag('nginx:latest');
    await Promise.resolve();
    await Promise.resolve();
    await ctx.settleDelete();
    await removePromise;

    expect(ctx.ImageService.deleteImage).toHaveBeenCalledWith('nginx:latest', false);
    expect(ctx.Notifications.success).toHaveBeenCalledWith('Image successfully deleted', 'nginx:latest');
    expect(ctx.$state.go).toHaveBeenCalledWith('docker.images', {}, { reload: true });
  });

  it('deletes one of several tags and reloads image details', async () => {
    confirmDeleteMock.mockResolvedValue(true);
    const ctx = buildController();
    await ctx.settleInit();

    const removePromise = ctx.$scope.removeTag('nginx:1.25');
    await Promise.resolve();
    await Promise.resolve();
    await ctx.settleDelete();
    await removePromise;

    expect(ctx.ImageService.deleteImage).toHaveBeenCalledWith('nginx:1.25', false);
    expect(ctx.Notifications.success).toHaveBeenCalledWith('Tag successfully deleted', 'nginx:1.25');
    expect(ctx.$state.go).toHaveBeenCalledWith('docker.images.image', { id: 'sha256:abc' }, { reload: true });
  });

  it('notifies when removeTag fails', async () => {
    confirmDeleteMock.mockResolvedValue(true);
    const err = new Error('delete tag failed');
    const ctx = buildController({ deleteError: err });
    await ctx.settleInit();

    const removePromise = ctx.$scope.removeTag('nginx:latest');
    await Promise.resolve();
    await Promise.resolve();
    await ctx.settleDelete();
    await removePromise;

    expect(ctx.Notifications.error).toHaveBeenCalledWith('Failure', err, 'Unable to remove image');
  });

  it('does nothing when removeImage confirmation is cancelled', async () => {
    confirmDeleteMock.mockResolvedValue(false);
    const ctx = buildController();
    await ctx.settleInit();

    await ctx.$scope.removeImage('sha256:abc');

    expect(confirmDeleteMock).toHaveBeenCalledWith(
      'Deleting this image will also delete all associated tags. Are you sure you want to delete this image?'
    );
    expect(ctx.ImageService.deleteImage).not.toHaveBeenCalled();
  });

  it('removes the image and returns to the images list on success', async () => {
    confirmDeleteMock.mockResolvedValue(true);
    const ctx = buildController();
    await ctx.settleInit();

    const removePromise = ctx.$scope.removeImage('sha256:abc');
    await Promise.resolve();
    await Promise.resolve();
    await ctx.settleDelete();
    await removePromise;

    expect(ctx.ImageService.deleteImage).toHaveBeenCalledWith('sha256:abc', false);
    expect(ctx.Notifications.success).toHaveBeenCalledWith('Image successfully deleted', 'sha256:abc');
    expect(ctx.$state.go).toHaveBeenCalledWith('docker.images', {}, { reload: true });
  });

  it('notifies when removeImage fails', async () => {
    confirmDeleteMock.mockResolvedValue(true);
    const err = new Error('delete image failed');
    const ctx = buildController({ deleteError: err });
    await ctx.settleInit();

    const removePromise = ctx.$scope.removeImage('sha256:abc');
    await Promise.resolve();
    await Promise.resolve();
    await ctx.settleDelete();
    await removePromise;

    expect(ctx.Notifications.error).toHaveBeenCalledWith('Failure', err, 'Unable to remove image');
  });

  it('warns when exporting an untagged image', async () => {
    const ctx = buildController({
      image: { Id: 'sha256:abc', RepoTags: ['<none>'], Env: [], NodeName: 'agent-node' },
    });
    await ctx.settleInit();

    ctx.$scope.exportImage(ctx.$scope.image);

    expect(ctx.Notifications.warning).toHaveBeenCalledWith('', 'Cannot download a untagged image');
    expect(confirmImageExportMock).not.toHaveBeenCalled();
    expect(ctx.ImageService.downloadImages).not.toHaveBeenCalled();
  });

  it('warns when exporting an image with no tags', async () => {
    const ctx = buildController({
      image: { Id: 'sha256:abc', RepoTags: [], Env: [], NodeName: 'agent-node' },
    });
    await ctx.settleInit();

    ctx.$scope.exportImage(ctx.$scope.image);

    expect(ctx.Notifications.warning).toHaveBeenCalledWith('', 'Cannot download a untagged image');
  });

  it('does not export when the export caution is cancelled', async () => {
    confirmImageExportMock.mockResolvedValue(false);
    const ctx = buildController();
    await ctx.settleInit();

    ctx.$scope.exportImage(ctx.$scope.image);
    await Promise.resolve();
    await Promise.resolve();

    expect(confirmImageExportMock).toHaveBeenCalled();
    expect(ctx.ImageService.downloadImages).not.toHaveBeenCalled();
  });

  it('exports the image as a tar archive on confirm', async () => {
    confirmImageExportMock.mockResolvedValue(true);
    const ctx = buildController();
    await ctx.settleInit();

    ctx.$scope.exportImage(ctx.$scope.image);
    await Promise.resolve();
    await Promise.resolve();

    expect(ctx.HttpRequestHelper.setPortainerAgentTargetHeader).toHaveBeenCalledWith('agent-node');
    expect(ctx.$scope.state.exportInProgress).toBe(true);
    expect(ctx.ImageService.downloadImages).toHaveBeenCalledWith([
      { tags: ['nginx:latest', 'nginx:1.25'], id: 'sha256:abc' },
    ]);

    await ctx.settleDownload();

    expect(ctx.Blob).toHaveBeenCalledWith([expect.any(ArrayBuffer)], { type: 'application/x-tar' });
    expect(ctx.FileSaver.saveAs).toHaveBeenCalledWith(expect.any(Object), 'images.tar');
    expect(ctx.Notifications.success).toHaveBeenCalledWith('Success', 'Image successfully downloaded');
    expect(ctx.$scope.state.exportInProgress).toBe(false);
  });

  it('notifies when image export fails and clears the progress flag', async () => {
    confirmImageExportMock.mockResolvedValue(true);
    const err = new Error('download failed');
    const ctx = buildController({ downloadError: err });
    await ctx.settleInit();

    ctx.$scope.exportImage(ctx.$scope.image);
    await Promise.resolve();
    await Promise.resolve();
    await ctx.settleDownload();

    expect(ctx.Notifications.error).toHaveBeenCalledWith('Failure', err, 'Unable to download image');
    expect(ctx.$scope.state.exportInProgress).toBe(false);
  });
});
