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
    copy: (value) => structuredClone(value),
  };
  globalThis.angular = angularMock;
  return { controllerState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
  copy: angularMock.copy,
}));

vi.mock('../../../../portainer/components/accessControlForm/porAccessControlFormModel', () => ({
  AccessControlFormData: function AccessControlFormData() {
    this.AccessControlEnabled = true;
    this.Ownership = 'private';
    this.AuthorizedUsers = [];
    this.AuthorizedTeams = [];
  },
}));

vi.mock('../../../components/network-macvlan-form/networkMacvlanFormModel', () => ({
  MacvlanFormData: function MacvlanFormData() {
    this.Scope = 'local';
    this.SelectedNetworkConfig = null;
    this.DatatableState = { selectedItems: [] };
    this.ParentNetworkCard = '';
  },
}));

await import('./createNetworkController.js');

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
  const $scope = {
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
  return $scope;
}

function buildController(options = {}) {
  const {
    scopeOverrides = {},
    endpoint = { Id: 1, Name: 'local' },
    pluginsResult = ['bridge', 'host', 'null', 'macvlan', 'ipvlan', 'overlay'],
    pluginsError = null,
    networkCreateResult = { Id: 'net-1', Portainer: { ResourceControl: { Id: 9 } } },
    networkCreateError = null,
    validateAccessControl = () => '',
    isAdmin = true,
    userDetails = { ID: 42 },
  } = options;

  const $scope = buildScope(scopeOverrides);
  const $state = { go: vi.fn() };
  const Notifications = { success: vi.fn(), error: vi.fn() };
  const LabelHelper = {
    fromKeyValueToLabelHash: vi.fn((labels) => {
      const out = {};
      (labels || []).forEach((label) => {
        if (label.key) {
          out[label.key] = label.value;
        }
      });
      return out;
    }),
  };
  const Authentication = {
    getUserDetails: vi.fn(() => userDetails),
    isAdmin: vi.fn(() => isAdmin),
  };
  const FormValidator = { validateAccessControl: vi.fn(validateAccessControl) };
  const ResourceControlService = {
    applyResourceControl: vi.fn(() => Promise.resolve()),
  };
  const HttpRequestHelper = {};

  const pluginsPromise = deferred();
  const PluginService = {
    networkPlugins: vi.fn(() => pluginsPromise),
  };

  const createPromise = deferred();
  const NetworkService = {
    create: vi.fn(() => createPromise),
  };

  const $q = {};

  controllerState.ctor(
    $q,
    $scope,
    $state,
    PluginService,
    Notifications,
    NetworkService,
    LabelHelper,
    Authentication,
    ResourceControlService,
    FormValidator,
    HttpRequestHelper,
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
    NetworkService,
    LabelHelper,
    Authentication,
    ResourceControlService,
    FormValidator,
    createPromise,
    networkCreateResult,
    networkCreateError,
    async settleCreate() {
      if (networkCreateError) {
        createPromise.reject(networkCreateError);
      } else {
        createPromise.resolve(networkCreateResult);
      }
      await createPromise.catch(() => undefined);
      // flush resource-control / notify microtasks
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

describe('REQ-NET-02 CreateNetworkController local Docker create form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes defaults and filters host/null drivers after initView', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    expect(ctx.$scope.config.Driver).toBe('bridge');
    expect(ctx.$scope.config.CheckDuplicate).toBe(true);
    expect(ctx.$scope.config.IPAM).toEqual({ Driver: 'default', Config: [] });
    expect(ctx.$scope.formValues.IPV4.Subnet).toBe('');
    expect(ctx.$scope.formValues.Labels).toEqual([]);
    expect(ctx.$scope.state.actionInProgress).toBe(false);
    expect(ctx.PluginService.networkPlugins).toHaveBeenCalledWith(false);
    expect(ctx.$scope.availableNetworkDrivers).toEqual(['bridge', 'macvlan', 'ipvlan', 'overlay']);
    expect(ctx.$scope.state.IPV4AuxiliaryAddressesError).toEqual([]);
    expect(ctx.$scope.state.IPV6AuxiliaryAddressesError).toEqual([]);
  });

  it('requests force=true network plugins when apiVersion is below 1.25', async () => {
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
    expect(ctx.PluginService.networkPlugins).toHaveBeenCalledWith(true);
  });

  it('notifies when network drivers cannot be retrieved', async () => {
    const err = new Error('plugins down');
    const ctx = buildController({ pluginsError: err });
    await ctx.settlePlugins();
    expect(ctx.Notifications.error).toHaveBeenCalledWith('Failure', err, 'Unable to retrieve network drivers');
  });

  it('adds and removes driver options, labels, and auxiliary addresses', async () => {
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

    ctx.$scope.addLabel();
    expect(ctx.$scope.formValues.Labels).toEqual([{ key: '', value: '' }]);
    ctx.$scope.removeLabel(0);
    expect(ctx.$scope.formValues.Labels).toEqual([]);

    ctx.$scope.addIPV4AuxAddress();
    ctx.$scope.addIPV6AuxAddress();
    ctx.$scope.state.IPV4AuxiliaryAddressesError = [true];
    ctx.$scope.state.IPV6AuxiliaryAddressesError = [false];
    expect(ctx.$scope.formValues.IPV4.AuxiliaryAddresses).toEqual(['']);
    expect(ctx.$scope.formValues.IPV6.AuxiliaryAddresses).toEqual(['']);
    ctx.$scope.removeIPV4AuxAddress(0);
    ctx.$scope.removeIPV6AuxAddress(0);
    expect(ctx.$scope.formValues.IPV4.AuxiliaryAddresses).toEqual([]);
    expect(ctx.$scope.formValues.IPV6.AuxiliaryAddresses).toEqual([]);
    expect(ctx.$scope.state.IPV4AuxiliaryAddressesError).toEqual([]);
    expect(ctx.$scope.state.IPV6AuxiliaryAddressesError).toEqual([]);
  });

  it('flags auxiliary addresses that collide with the gateway and drives isValid', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.formValues.IPV4.Gateway = '172.20.10.11';
    ctx.$scope.formValues.IPV4.AuxiliaryAddresses = ['172.20.10.11', 'router=172.20.10.11', '172.20.10.12'];
    ctx.$scope.state.IPV4AuxiliaryAddressesError = [false, false, false];
    ctx.$scope.checkIPV4AuxiliaryAddress(0);
    ctx.$scope.checkIPV4AuxiliaryAddress(1);
    ctx.$scope.checkIPV4AuxiliaryAddress(2);
    expect(ctx.$scope.state.IPV4AuxiliaryAddressesError).toEqual([true, true, false]);

    ctx.$scope.formValues.IPV6.Gateway = '2001:db8::1';
    ctx.$scope.formValues.IPV6.AuxiliaryAddresses = ['gw=2001:db8::1', '2001:db8::2'];
    ctx.$scope.state.IPV6AuxiliaryAddressesError = [false, false];
    ctx.$scope.checkIPV6AuxiliaryAddress(0);
    ctx.$scope.checkIPV6AuxiliaryAddress(1);
    expect(ctx.$scope.state.IPV6AuxiliaryAddressesError).toEqual([true, false]);

    expect(ctx.$scope.isValid()).toBe(false);
    ctx.$scope.state.IPV4AuxiliaryAddressesError = [false, false, false];
    ctx.$scope.state.IPV6AuxiliaryAddressesError = [false, false];
    expect(ctx.$scope.isValid()).toBe(true);
  });

  it('toggles internal and attachable via onChange handlers', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.onChangeInternal(true);
    ctx.$scope.onChangeAttachable(true);
    expect(ctx.$scope.config.Internal).toBe(true);
    expect(ctx.$scope.config.Attachable).toBe(true);
  });

  it('stops create when access-control validation fails', async () => {
    const ctx = buildController({
      validateAccessControl: () => 'You must specify at least one team or user.',
    });
    await ctx.settlePlugins();

    ctx.$scope.create();

    expect(ctx.$scope.state.formValidationError).toBe('You must specify at least one team or user.');
    expect(ctx.NetworkService.create).not.toHaveBeenCalled();
  });

  it('creates a bridge network with IPv4 subnet, gateway, IP range, aux addresses, labels and driver options', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.config.Name = 'app-net';
    ctx.$scope.config.Driver = 'bridge';
    ctx.$scope.config.Internal = true;
    ctx.$scope.formValues.IPV4.Subnet = '172.20.0.0/16';
    ctx.$scope.formValues.IPV4.Gateway = '172.20.0.1';
    ctx.$scope.formValues.IPV4.IPRange = '172.20.10.0/24';
    ctx.$scope.formValues.IPV4.AuxiliaryAddresses = ['router=172.20.10.2', '172.20.10.3'];
    ctx.$scope.formValues.DriverOptions = [{ name: 'com.docker.network.bridge.enable_icc', value: 'true' }];
    ctx.$scope.formValues.Labels = [
      { key: 'env', value: 'dev' },
      { key: '', value: 'ignored' },
    ];
    ctx.$scope.formValues.NodeName = 'node-a';

    ctx.$scope.create();
    expect(ctx.$scope.state.actionInProgress).toBe(true);

    expect(ctx.NetworkService.create).toHaveBeenCalledTimes(1);
    const [config, opts] = ctx.NetworkService.create.mock.calls[0];
    expect(opts).toEqual({ nodeName: 'node-a', agentManagerOperation: false });
    expect(config.Name).toBe('app-net');
    expect(config.Driver).toBe('bridge');
    expect(config.Internal).toBe(true);
    expect(config.Options).toEqual({ 'com.docker.network.bridge.enable_icc': 'true' });
    expect(ctx.LabelHelper.fromKeyValueToLabelHash).toHaveBeenCalled();
    expect(config.Labels).toEqual({ env: 'dev' });
    expect(config.IPAM.Config).toEqual([
      {
        Subnet: '172.20.0.0/16',
        Gateway: '172.20.0.1',
        IPRange: '172.20.10.0/24',
        AuxiliaryAddresses: { router: '172.20.10.2', device1: '172.20.10.3' },
      },
    ]);

    await ctx.settleCreate();
    expect(ctx.ResourceControlService.applyResourceControl).toHaveBeenCalledWith(
      42,
      ctx.$scope.formValues.AccessControlData,
      { Id: 9 }
    );
    expect(ctx.Notifications.success).toHaveBeenCalledWith('Success', 'Network successfully created');
    expect(ctx.$state.go).toHaveBeenCalledWith('docker.networks', {}, { reload: true });
    expect(ctx.$scope.state.actionInProgress).toBe(false);
  });

  it('creates an ipvlan network with IPv6 configuration enabling EnableIPv6', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.config.Name = 'v6-net';
    ctx.$scope.config.Driver = 'ipvlan';
    ctx.$scope.formValues.IPV6.Subnet = '2001:db8::/48';
    ctx.$scope.formValues.IPV6.Gateway = '2001:db8::1';
    ctx.$scope.formValues.IPV6.IPRange = '2001:db8::/64';
    ctx.$scope.formValues.IPV6.AuxiliaryAddresses = ['router=2001:db8::2'];

    ctx.$scope.create();

    const [config] = ctx.NetworkService.create.mock.calls[0];
    expect(config.Driver).toBe('ipvlan');
    expect(config.EnableIPv6).toBe(true);
    expect(config.IPAM.Config).toEqual([
      {
        Subnet: '2001:db8::/48',
        Gateway: '2001:db8::1',
        IPRange: '2001:db8::/64',
        AuxiliaryAddresses: { router: '2001:db8::2' },
      },
    ]);

    await ctx.settleCreate();
    expect(ctx.Notifications.success).toHaveBeenCalled();
  });

  it('notifies on network creation failure', async () => {
    const err = new Error('create failed');
    const ctx = buildController({ networkCreateError: err });
    await ctx.settlePlugins();

    ctx.$scope.config.Name = 'bad-net';
    ctx.$scope.create();
    await ctx.settleCreate();

    expect(ctx.Notifications.error).toHaveBeenCalledWith('Failure', err, 'An error occurred during network creation');
    expect(ctx.$state.go).not.toHaveBeenCalled();
    expect(ctx.$scope.state.actionInProgress).toBe(false);
  });

  it('creates a local macvlan config-only network with parent NIC option', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.config.Name = 'macvlan-cfg';
    ctx.$scope.config.Driver = 'macvlan';
    ctx.$scope.config.Internal = true;
    ctx.$scope.config.Attachable = true;
    ctx.$scope.formValues.Macvlan.Scope = 'local';
    ctx.$scope.formValues.Macvlan.ParentNetworkCard = 'eth0';
    ctx.$scope.formValues.IPV4.Subnet = '192.168.1.0/24';

    ctx.$scope.create();

    const [config, opts] = ctx.NetworkService.create.mock.calls[0];
    expect(opts.agentManagerOperation).toBe(false);
    expect(config.ConfigOnly).toBe(true);
    expect(config.Internal).toBeNull();
    expect(config.Attachable).toBeNull();
    expect(config.Options.parent).toBe('eth0');
    expect(config.IPAM.Config[0].Subnet).toBe('192.168.1.0/24');

    await ctx.settleCreate();
    expect(ctx.Notifications.success).toHaveBeenCalled();
  });

  it('creates a macvlan network from an existing config with local scope on standalone Docker', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.config.Name = 'macvlan-from';
    ctx.$scope.config.Driver = 'macvlan';
    ctx.$scope.formValues.Macvlan.Scope = 'swarm';
    ctx.$scope.formValues.Macvlan.SelectedNetworkConfig = {
      Name: 'cfg-net',
      NodeName: 'worker-1',
    };

    ctx.$scope.create();

    const [config, opts] = ctx.NetworkService.create.mock.calls[0];
    expect(opts.nodeName).toBe('worker-1');
    expect(config.ConfigFrom).toEqual({ Network: 'cfg-net' });
    expect(config.Scope).toBe('local');

    await ctx.settleCreate();
    expect(ctx.$state.go).toHaveBeenCalledWith('docker.networks', {}, { reload: true });
  });

  it('creates a plain bridge network without IPAM when no subnet is set', async () => {
    const ctx = buildController();
    await ctx.settlePlugins();

    ctx.$scope.config.Name = 'simple';
    ctx.$scope.create();

    const [config] = ctx.NetworkService.create.mock.calls[0];
    expect(config.IPAM.Config).toEqual([]);
    expect(config.Options).toEqual({});
    expect(config.Labels).toEqual({});

    await ctx.settleCreate();
    expect(ctx.Notifications.success).toHaveBeenCalled();
  });
});
