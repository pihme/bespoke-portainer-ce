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
  };
  globalThis.angular = angularMock;
  return { controllerState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('../../../../portainer/components/accessControlForm/porAccessControlFormModel', () => ({
  AccessControlFormData: function AccessControlFormData() {
    this.AccessControlEnabled = true;
    this.Ownership = 'private';
    this.AuthorizedUsers = [];
    this.AuthorizedTeams = [];
  },
}));

vi.mock('../../../components/volumesNFSForm/volumesNFSFormModel', () => ({
  VolumesNFSFormData: function VolumesNFSFormData() {
    this.useNFS = false;
    this.serverAddress = '';
    this.mountPoint = '';
    this.version = 'NFS4';
    this.options = 'rw,noatime,rsize=8192,wsize=8192,tcp,timeo=14';
    this.versions = ['NFS4', 'NFS'];
  },
}));

vi.mock('../../../components/volumesCIFSForm/volumesCifsFormModel', () => ({
  VolumesCIFSFormData: function VolumesCIFSFormData() {
    this.useCIFS = false;
    this.serverAddress = '';
    this.share = '';
    this.version = 'CIFS v2.0 (Used by Windows Vista / Server 2008)';
    this.versions = [
      'CIFS v1.0 (Used by Windows XP / Server 2003 and earlier)',
      'CIFS v2.0 (Used by Windows Vista / Server 2008)',
      'CIFS v2.1 (Used by Windows 7 / Server 2008 R2)',
      'CIFS 3.0 (Used by Windows 8 / Server 2012 and newer)',
    ];
    this.versionsNumber = ['1.0', '2.0', '2.1', '3.0'];
    this.username = '';
    this.password = '';
  },
}));

await import('./createVolumeController.js');

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

function buildScope(overrides = {}) {
  return {
    $evalAsync: (fn) => fn(),
    applicationState: {
      endpoint: {
        apiVersion: 1.41,
        mode: {
          provider: 'DOCKER_STANDALONE',
          agentProxy: false,
        },
      },
    },
    ...overrides,
  };
}

function buildController(options = {}) {
  const {
    scopeOverrides = {},
    endpoint = { Id: 1, Name: 'local' },
    pluginsResult = ['local', 'nfs', 'cifs'],
    pluginsError = null,
    volumeCreateResult = { Name: 'myVolume', ResourceControl: { Id: 9 } },
    volumeCreateError = null,
    validateAccessControl = () => '',
    isAdmin = true,
    userDetails = { ID: 42 },
  } = options;

  const $scope = buildScope(scopeOverrides);
  const $state = { go: vi.fn() };
  const Notifications = { success: vi.fn(), error: vi.fn() };
  const Authentication = {
    getUserDetails: vi.fn(() => userDetails),
    isAdmin: vi.fn(() => isAdmin),
  };
  const FormValidator = { validateAccessControl: vi.fn(validateAccessControl) };
  const ResourceControlService = {
    applyResourceControl: vi.fn(() => Promise.resolve()),
  };

  const pluginsPromise = deferred();
  const PluginService = {
    volumePlugins: vi.fn(() => pluginsPromise),
  };

  const createPromise = deferred();
  const VolumeService = {
    createVolumeConfiguration: vi.fn((name, driver, driverOptions) => ({
      Name: name,
      Driver: driver,
      DriverOpts: (driverOptions || []).reduce((res, { name: optName, value }) => ({ ...res, [optName]: value }), {}),
    })),
    createVolume: vi.fn(() => createPromise),
  };

  controllerState.ctor(
    $scope,
    $state,
    VolumeService,
    PluginService,
    ResourceControlService,
    Authentication,
    Notifications,
    FormValidator,
    endpoint
  );

  if (pluginsError) {
    pluginsPromise.reject(pluginsError);
  } else {
    pluginsPromise.resolve(pluginsResult);
  }

  return {
    $scope,
    $state,
    Notifications,
    PluginService,
    VolumeService,
    Authentication,
    ResourceControlService,
    FormValidator,
    createPromise,
    volumeCreateResult,
    volumeCreateError,
    async settleCreate() {
      if (volumeCreateError) {
        createPromise.reject(volumeCreateError);
      } else {
        createPromise.resolve(volumeCreateResult);
      }
      await createPromise.catch(() => undefined);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    },
    async settlePlugins() {
      await pluginsPromise.catch(() => undefined);
      await Promise.resolve();
    },
  };
}

describe('REQ-VOL-02 CreateVolumeController local Docker create form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes defaults and loads volume drivers after initView', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    expect(ctx.$scope.formValues.Driver).toBe('local');
    expect(ctx.$scope.formValues.DriverOptions).toEqual([]);
    expect(ctx.$scope.formValues.NodeName).toBeNull();
    expect(ctx.$scope.formValues.NFSData.useNFS).toBe(false);
    expect(ctx.$scope.formValues.CIFSData.useCIFS).toBe(false);
    expect(ctx.$scope.formValues.AccessControlData.Ownership).toBe('private');
    expect(ctx.$scope.state.formValidationError).toBe('');
    expect(ctx.$scope.state.actionInProgress).toBe(false);
    expect(ctx.$scope.endpoint).toEqual({ Id: 1, Name: 'local' });
    expect(ctx.PluginService.volumePlugins).toHaveBeenCalledWith(false);
    expect(ctx.$scope.availableVolumeDrivers).toEqual(['local', 'nfs', 'cifs']);
  });

  it('requests force=true volume plugins when apiVersion is below 1.25', async () => {
    const ctx = buildController({
      scopeOverrides: {
        applicationState: {
          endpoint: {
            apiVersion: 1.24,
            mode: { provider: 'DOCKER_STANDALONE', agentProxy: false },
          },
        },
      },
    });
    await ctx.settlePlugins();
    expect(ctx.PluginService.volumePlugins).toHaveBeenCalledWith(true);
  });

  it('notifies when volume drivers cannot be retrieved', async () => {
    const err = new Error('plugins down');
    const ctx = buildController({ pluginsError: err });
    await ctx.settlePlugins();
    expect(ctx.Notifications.error).toHaveBeenCalledWith('Failure', err, 'Unable to retrieve volume drivers');
  });

  it('adds and removes driver options', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.addDriverOption();
    ctx.$scope.addDriverOption();
    expect(ctx.$scope.formValues.DriverOptions).toEqual([
      { name: '', value: '' },
      { name: '', value: '' },
    ]);
    ctx.$scope.removeDriverOption(0);
    expect(ctx.$scope.formValues.DriverOptions).toEqual([{ name: '', value: '' }]);
  });

  it('toggles NFS on and clears CIFS via onUseNFSChange', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.formValues.CIFSData.useCIFS = true;
    ctx.$scope.onUseNFSChange(true);
    expect(ctx.$scope.formValues.NFSData.useNFS).toBe(true);
    expect(ctx.$scope.formValues.CIFSData.useCIFS).toBe(false);
  });

  it('toggles CIFS on and clears NFS via onUseCIFSChange', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.formValues.NFSData.useNFS = true;
    ctx.$scope.onUseCIFSChange(true);
    expect(ctx.$scope.formValues.CIFSData.useCIFS).toBe(true);
    expect(ctx.$scope.formValues.NFSData.useNFS).toBe(false);
  });

  it('stops create when access-control validation fails', async () => {
    const ctx = buildController({
      validateAccessControl: () => 'You must specify at least one team or user.',
    });
    await ctx.settlePlugins();

    ctx.$scope.formValues.Name = 'blocked';
    ctx.$scope.create();

    expect(ctx.$scope.state.formValidationError).toBe('You must specify at least one team or user.');
    expect(ctx.VolumeService.createVolume).not.toHaveBeenCalled();
    expect(ctx.$scope.state.actionInProgress).toBe(false);
  });

  it('creates a local volume with name, driver and driver options', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.formValues.Name = 'myVolume';
    ctx.$scope.formValues.Driver = 'local';
    ctx.$scope.formValues.DriverOptions = [{ name: 'device', value: 'tmpfs' }, { name: 'type', value: 'tmpfs' }];
    ctx.$scope.formValues.NodeName = null;

    ctx.$scope.create();
    expect(ctx.$scope.state.actionInProgress).toBe(true);
    expect(ctx.VolumeService.createVolumeConfiguration).toHaveBeenCalledWith('myVolume', 'local', [
      { name: 'device', value: 'tmpfs' },
      { name: 'type', value: 'tmpfs' },
    ]);
    expect(ctx.VolumeService.createVolume).toHaveBeenCalledWith(
      {
        Name: 'myVolume',
        Driver: 'local',
        DriverOpts: { device: 'tmpfs', type: 'tmpfs' },
      },
      null
    );

    await ctx.settleCreate();
    expect(ctx.ResourceControlService.applyResourceControl).toHaveBeenCalledWith(
      42,
      ctx.$scope.formValues.AccessControlData,
      { Id: 9 }
    );
    expect(ctx.Notifications.success).toHaveBeenCalledWith('Success', 'Volume successfully created');
    expect(ctx.$state.go).toHaveBeenCalledWith('docker.volumes', {}, { reload: true });
    expect(ctx.$scope.state.actionInProgress).toBe(false);
  });

  it('creates an NFS4 volume with server, mount point and nfsvers option', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.formValues.Name = 'nfs-vol';
    ctx.$scope.formValues.Driver = 'local';
    ctx.$scope.formValues.NFSData.useNFS = true;
    ctx.$scope.formValues.NFSData.serverAddress = 'nfs.example.com';
    ctx.$scope.formValues.NFSData.mountPoint = '/exports/data';
    ctx.$scope.formValues.NFSData.version = 'NFS4';
    ctx.$scope.formValues.NFSData.options = 'rw,noatime';

    ctx.$scope.create();

    const [config] = ctx.VolumeService.createVolume.mock.calls[0];
    expect(config.Name).toBe('nfs-vol');
    expect(config.Driver).toBe('local');
    expect(config.DriverOpts).toEqual({
      type: 'nfs',
      o: 'addr=nfs.example.com,rw,noatime,nfsvers=4',
      device: ':/exports/data',
    });

    await ctx.settleCreate();
    expect(ctx.Notifications.success).toHaveBeenCalled();
  });

  it('creates an NFS3 volume without nfsvers and keeps an existing colon in the mount point', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.formValues.Name = 'nfs3-vol';
    ctx.$scope.formValues.Driver = 'local';
    ctx.$scope.formValues.NFSData.useNFS = true;
    ctx.$scope.formValues.NFSData.serverAddress = '10.0.0.5';
    ctx.$scope.formValues.NFSData.mountPoint = ':/mnt/share';
    ctx.$scope.formValues.NFSData.version = 'NFS';
    ctx.$scope.formValues.NFSData.options = 'ro';

    ctx.$scope.create();

    const [config] = ctx.VolumeService.createVolume.mock.calls[0];
    expect(config.DriverOpts).toEqual({
      type: 'nfs',
      o: 'addr=10.0.0.5,ro',
      device: ':/mnt/share',
    });

    await ctx.settleCreate();
    expect(ctx.$state.go).toHaveBeenCalledWith('docker.volumes', {}, { reload: true });
  });

  it('creates a CIFS volume normalizing share path and version', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.formValues.Name = 'cifs-vol';
    ctx.$scope.formValues.Driver = 'local';
    ctx.$scope.formValues.CIFSData.useCIFS = true;
    ctx.$scope.formValues.CIFSData.serverAddress = 'files.example.com';
    ctx.$scope.formValues.CIFSData.share = 'shared\\folder';
    ctx.$scope.formValues.CIFSData.version = 'CIFS v2.0 (Used by Windows Vista / Server 2008)';
    ctx.$scope.formValues.CIFSData.username = 'alice';
    ctx.$scope.formValues.CIFSData.password = 's3cret';

    ctx.$scope.create();

    const [config] = ctx.VolumeService.createVolume.mock.calls[0];
    expect(config.DriverOpts).toEqual({
      type: 'cifs',
      device: '//files.example.com/shared/folder',
      o: 'addr=files.example.com,username=alice,password=s3cret,vers=2.0',
    });

    await ctx.settleCreate();
    expect(ctx.Notifications.success).toHaveBeenCalled();
  });

  it('prefixes a leading slash on CIFS shares that omit it', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.formValues.Name = 'cifs-root';
    ctx.$scope.formValues.Driver = 'local';
    ctx.$scope.formValues.CIFSData.useCIFS = true;
    ctx.$scope.formValues.CIFSData.serverAddress = 'smb.local';
    ctx.$scope.formValues.CIFSData.share = 'public';
    ctx.$scope.formValues.CIFSData.version = 'CIFS 3.0 (Used by Windows 8 / Server 2012 and newer)';
    ctx.$scope.formValues.CIFSData.username = 'bob';
    ctx.$scope.formValues.CIFSData.password = 'pw';

    ctx.$scope.create();

    const [config] = ctx.VolumeService.createVolume.mock.calls[0];
    expect(config.DriverOpts.device).toBe('//smb.local/public');
    expect(config.DriverOpts.o).toContain('vers=3.0');

    await ctx.settleCreate();
    expect(ctx.Notifications.success).toHaveBeenCalled();
  });

  it('keeps a CIFS share that already starts with a slash', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.formValues.Name = 'cifs-slash';
    ctx.$scope.formValues.Driver = 'local';
    ctx.$scope.formValues.CIFSData.useCIFS = true;
    ctx.$scope.formValues.CIFSData.serverAddress = 'smb.local';
    ctx.$scope.formValues.CIFSData.share = '/already';
    ctx.$scope.formValues.CIFSData.version = 'CIFS v1.0 (Used by Windows XP / Server 2003 and earlier)';
    ctx.$scope.formValues.CIFSData.username = 'carol';
    ctx.$scope.formValues.CIFSData.password = 'pw';

    ctx.$scope.create();

    const [config] = ctx.VolumeService.createVolume.mock.calls[0];
    expect(config.DriverOpts.device).toBe('//smb.local/already');
    expect(config.DriverOpts.o).toContain('vers=1.0');

    await ctx.settleCreate();
    expect(ctx.Notifications.success).toHaveBeenCalled();
  });

  it('passes NodeName through to VolumeService.createVolume', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.formValues.Name = 'node-vol';
    ctx.$scope.formValues.Driver = 'local';
    ctx.$scope.formValues.NodeName = 'worker-1';

    ctx.$scope.create();

    expect(ctx.VolumeService.createVolume).toHaveBeenCalledWith(expect.any(Object), 'worker-1');
    await ctx.settleCreate();
  });

  it('notifies on volume creation failure', async () => {
    const err = new Error('create failed');
    const ctx = buildController({ volumeCreateError: err });
    await ctx.settlePlugins();

    ctx.$scope.formValues.Name = 'bad-vol';
    ctx.$scope.create();
    await ctx.settleCreate();

    expect(ctx.Notifications.error).toHaveBeenCalledWith('Failure', err, 'An error occurred during volume creation');
    expect(ctx.$state.go).not.toHaveBeenCalled();
    expect(ctx.$scope.state.actionInProgress).toBe(false);
  });

  it('clears a previous formValidationError when validation later succeeds', async () => {
    const ctx = buildController({
      validateAccessControl: vi.fn().mockReturnValueOnce('access denied').mockReturnValueOnce(''),
    });
    await ctx.settlePlugins();

    ctx.$scope.formValues.Name = 'retry-vol';
    ctx.$scope.create();
    expect(ctx.$scope.state.formValidationError).toBe('access denied');
    expect(ctx.VolumeService.createVolume).not.toHaveBeenCalled();

    ctx.$scope.create();
    expect(ctx.$scope.state.formValidationError).toBe('');
    expect(ctx.VolumeService.createVolume).toHaveBeenCalledTimes(1);
    await ctx.settleCreate();
    expect(ctx.Notifications.success).toHaveBeenCalled();
  });
});
