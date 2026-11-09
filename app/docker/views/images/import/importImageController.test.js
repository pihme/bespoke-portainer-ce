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

vi.mock('@/docker/models/porImageRegistry', () => ({
  PorImageRegistryModel: function PorImageRegistryModel() {
    this.Image = '';
  },
}));

await import('./importImageController.js');

describe('ImportImageController local Docker image import', () => {
  let $scope;
  let $state;
  let $async;
  let ImageService;
  let Notifications;
  let HttpRequestHelper;
  let Authentication;
  let ImageHelper;
  let endpoint;

  beforeEach(() => {
    $scope = {};
    $state = { go: vi.fn() };
    $async = (fn) => fn();
    ImageService = {
      uploadImage: vi.fn(),
      tagImage: vi.fn(),
    };
    Notifications = {
      error: vi.fn(),
      success: vi.fn(),
    };
    HttpRequestHelper = {
      setPortainerAgentTargetHeader: vi.fn(),
    };
    Authentication = { isAdmin: vi.fn(() => true) };
    ImageHelper = {
      createImageConfigForContainer: vi.fn(() => ({
        repo: 'local/web',
        tag: 'latest',
      })),
    };
    endpoint = { Id: 1 };
  });

  function create() {
    controllerState.ctor(
      $scope,
      $state,
      $async,
      ImageService,
      Notifications,
      HttpRequestHelper,
      Authentication,
      ImageHelper,
      endpoint
    );
    return $scope;
  }

  it('initializes form state for a local image upload', () => {
    const scope = create();
    expect(scope.state.actionInProgress).toBe(false);
    expect(scope.endpoint).toBe(endpoint);
    expect(scope.isAdmin).toBe(true);
    expect(scope.formValues.UploadFile).toBeNull();
    expect(scope.formValues.RegistryModel).toBeTruthy();

    scope.setPullImageValidity(true);
    expect(scope.state.pullImageValidity).toBe(true);
  });

  it('uploads a single local image, tags it, and navigates to the image', async () => {
    ImageService.uploadImage.mockResolvedValue({
      data: { stream: 'Loaded image ID: sha256:abc\n' },
    });
    ImageService.tagImage.mockResolvedValue({});
    const scope = create();
    scope.formValues.UploadFile = new Blob(['tar']);
    scope.formValues.RegistryModel.Image = 'local/web:latest';
    scope.formValues.NodeName = null;

    await scope.uploadImage();

    expect(HttpRequestHelper.setPortainerAgentTargetHeader).toHaveBeenCalledWith(
      null
    );
    expect(ImageService.uploadImage).toHaveBeenCalled();
    expect(ImageHelper.createImageConfigForContainer).toHaveBeenCalled();
    expect(ImageService.tagImage).toHaveBeenCalledWith(
      'sha256:abc',
      'local/web',
      'latest'
    );
    expect($state.go).toHaveBeenCalledWith(
      'docker.images.image',
      { id: 'sha256:abc' },
      { reload: true }
    );
    expect(Notifications.success).toHaveBeenCalledWith(
      'Success',
      'Images successfully uploaded'
    );
    expect(scope.state.actionInProgress).toBe(false);
  });

  it('ignores tagging when the tar contains multiple images', async () => {
    ImageService.uploadImage.mockResolvedValue({ data: {} });
    const scope = create();
    scope.formValues.UploadFile = new Blob(['tar']);

    await scope.uploadImage();

    expect(Notifications.success).toHaveBeenCalledWith(
      'Success',
      'The uploaded tar file contained multiple images. The provided tag therefore has been ignored.'
    );
    expect(ImageService.tagImage).not.toHaveBeenCalled();
  });

  it('reports an upload payload error', async () => {
    ImageService.uploadImage.mockResolvedValue({
      data: { error: 'bad tar' },
    });
    const scope = create();
    scope.formValues.UploadFile = new Blob(['tar']);

    await scope.uploadImage();

    expect(Notifications.error).toHaveBeenCalledWith(
      'Failure',
      'bad tar',
      'Unable to upload image'
    );
  });

  it('reports thrown upload failures', async () => {
    ImageService.uploadImage.mockRejectedValue(new Error('network'));
    const scope = create();
    scope.formValues.UploadFile = new Blob(['tar']);

    await scope.uploadImage();

    expect(Notifications.error).toHaveBeenCalledWith(
      'Failure',
      expect.any(Error),
      'Unable to upload image'
    );
  });

  it('reports tag failures without failing the upload success path', async () => {
    ImageService.uploadImage.mockResolvedValue({
      data: { stream: 'Loaded image: sha256:def\n' },
    });
    ImageService.tagImage.mockRejectedValue(new Error('tag fail'));
    const scope = create();
    scope.formValues.UploadFile = new Blob(['tar']);
    scope.formValues.RegistryModel.Image = 'local/web';

    await scope.uploadImage();

    expect(Notifications.error).toHaveBeenCalledWith(
      'Failure',
      expect.any(Error),
      'Unable to tag image'
    );
    expect(Notifications.success).toHaveBeenCalled();
  });

  it('skips tagging when no image name was provided', async () => {
    ImageService.uploadImage.mockResolvedValue({
      data: { stream: 'Loaded image ID: sha256:ghi\n' },
    });
    const scope = create();
    scope.formValues.UploadFile = new Blob(['tar']);
    scope.formValues.RegistryModel.Image = '';

    await scope.uploadImage();

    expect(ImageService.tagImage).not.toHaveBeenCalled();
    expect($state.go).toHaveBeenCalled();
  });
});
