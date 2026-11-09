import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PortainerEndpointTypes } from '@/portainer/models/endpoint/models';
import { AccessHeaders } from '@/portainer/authorization-guard';
import { EnvironmentStatus } from '@/react/portainer/environments/types';

const { moduleApi, angularMock, registeredStates, configFns, moduleRegistrations } = vi.hoisted(() => {
  const registeredStates = [];
  const configFns = [];
  const moduleRegistrations = [];
  const moduleApi = {
    config: vi.fn((depsOrFn) => {
      const fn = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      configFns.push(fn);
      return moduleApi;
    }),
  };
  const angularMock = {
    module: vi.fn((name, deps) => {
      moduleRegistrations.push({ name, deps });
      return moduleApi;
    }),
  };
  return { moduleApi, angularMock, registeredStates, configFns, moduleRegistrations };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('./react', () => ({
  reactModule: 'portainer.docker.react',
}));

await import('./__module.js');

function runConfig() {
  registeredStates.length = 0;
  const $stateRegistryProvider = {
    register: vi.fn((state) => {
      registeredStates.push(state);
      return state;
    }),
  };
  expect(configFns).toHaveLength(1);
  configFns[0]($stateRegistryProvider);
  return $stateRegistryProvider;
}

function stateByName(name) {
  const state = registeredStates.find((s) => s.name === name);
  expect(state, `missing state ${name}`).toBeDefined();
  return state;
}

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

function buildOnEnterDeps(overrides = {}) {
  const $state = { go: vi.fn() };
  const EndpointService = { updateEndpoint: vi.fn().mockResolvedValue(undefined) };
  const Notifications = { error: vi.fn() };
  const StateManager = { updateEndpointState: vi.fn().mockResolvedValue(undefined) };
  const SystemService = { ping: vi.fn().mockResolvedValue(undefined) };
  const EndpointProvider = { clean: vi.fn() };
  const $async = (fn) => fn();

  return {
    $async,
    $state,
    EndpointService,
    Notifications,
    StateManager,
    SystemService,
    EndpointProvider,
    ...overrides,
  };
}

async function invokeOnEnter(endpoint, deps) {
  const docker = stateByName('docker');
  return docker.onEnter(
    endpoint,
    deps.$async,
    deps.$state,
    deps.EndpointService,
    deps.Notifications,
    deps.StateManager,
    deps.SystemService,
    deps.EndpointProvider
  );
}

describe('Docker Angular module wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runConfig();
  });

  it('registers the portainer.docker module against portainer.app and the docker react module', () => {
    expect(moduleRegistrations).toEqual([
      { name: 'portainer.docker', deps: ['portainer.app', 'portainer.docker.react'] },
    ]);
    expect(configFns).toHaveLength(1);
  });

  it('registers the abstract docker parent and local container/image/volume/network routes', () => {
    const docker = stateByName('docker');
    expect(docker).toMatchObject({
      name: 'docker',
      parent: 'endpoint',
      url: '/docker',
      abstract: true,
    });
    expect(typeof docker.onEnter).toBe('function');

    expect(stateByName('docker.dashboard')).toMatchObject({
      url: '/dashboard',
      views: { 'content@': { component: 'dockerDashboardView' } },
      data: { docs: '/user/docker/dashboard' },
    });
    expect(stateByName('docker.images')).toMatchObject({
      url: '/images',
      views: { 'content@': { component: 'imagesListView' } },
      data: { docs: '/user/docker/images' },
    });
    expect(stateByName('docker.images.image')).toMatchObject({
      url: '/:id?nodeName',
      views: {
        'content@': {
          templateUrl: './views/images/edit/image.html',
          controller: 'ImageController',
        },
      },
    });
    expect(stateByName('docker.images.build')).toMatchObject({
      url: '/build',
      data: { docs: '/user/docker/images/build' },
    });
    expect(stateByName('docker.images.import')).toMatchObject({
      url: '/import',
      data: { docs: '/user/docker/images/import' },
    });
    expect(stateByName('docker.networks')).toMatchObject({
      url: '/networks',
      views: { 'content@': { component: 'networksListView' } },
      data: { docs: '/user/docker/networks' },
    });
    expect(stateByName('docker.networks.network')).toMatchObject({
      url: '/:id?nodeName',
      views: { 'content@': { component: 'networkDetailsView' } },
    });
    expect(stateByName('docker.networks.new')).toMatchObject({
      url: '/new',
      views: {
        'content@': {
          templateUrl: './views/networks/create/createnetwork.html',
          controller: 'CreateNetworkController',
        },
      },
      data: { docs: '/user/docker/networks/add' },
    });
    expect(stateByName('docker.volumes')).toMatchObject({
      url: '/volumes',
      views: {
        'content@': {
          templateUrl: './views/volumes/volumes.html',
          controller: 'VolumesController',
        },
      },
      data: { docs: '/user/docker/volumes' },
    });
    expect(stateByName('docker.volumes.volume')).toMatchObject({
      url: '/:id?nodeName',
      views: {
        'content@': {
          templateUrl: './views/volumes/edit/volume.html',
          controller: 'VolumeController',
        },
      },
    });
    expect(stateByName('docker.volumes.new')).toMatchObject({
      url: '/new',
      data: { docs: '/user/docker/volumes/add' },
    });
    expect(stateByName('docker.volumes.volume.browse')).toMatchObject({
      url: '/browse',
      views: {
        'content@': {
          templateUrl: './views/volumes/browse/browsevolume.html',
          controller: 'BrowseVolumeController',
        },
      },
    });
    expect(stateByName('docker.stacks')).toMatchObject({
      url: '/stacks',
      data: { docs: '/user/docker/stacks' },
    });
    expect(stateByName('docker.stacks.newstack')).toMatchObject({
      url: '/newstack',
      views: { 'content@': { component: 'createStackView' } },
    });
    expect(stateByName('docker.stacks.stack')).toMatchObject({
      views: { 'content@': { component: 'stackItemView' } },
    });
    expect(stateByName('docker.stacks.stack.container')).toMatchObject({
      url: '/:id?nodeName',
      views: { 'content@': { component: 'containerItemView' } },
    });
    expect(stateByName('docker.host')).toMatchObject({
      url: '/host',
      views: { 'content@': { component: 'hostView' } },
    });
    expect(stateByName('docker.events')).toMatchObject({
      url: '/events',
      views: { 'content@': { component: 'eventsListView' } },
    });
    expect(stateByName('docker.templates.custom')).toMatchObject({
      url: '/custom',
      views: { 'content@': { component: 'customTemplatesView' } },
    });
  });

  it('registers host feature-config and registry access states with admin access headers', () => {
    expect(stateByName('docker.host.featuresConfiguration')).toMatchObject({
      url: '/feat-config',
      views: { 'content@': { component: 'dockerFeaturesConfigurationView' } },
      data: { docs: '/user/docker/host/setup' },
    });
    expect(stateByName('docker.host.registries')).toMatchObject({
      url: '/registries',
      views: { 'content@': { component: 'environmentRegistriesView' } },
    });
    expect(stateByName('docker.host.registries.access')).toMatchObject({
      url: '/:id/access',
      views: { 'content@': { component: 'dockerRegistryAccessView' } },
      data: { access: AccessHeaders.Admin },
    });
  });
});

describe('REQ-HOST-01 Docker environment onEnter gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runConfig();
  });

  it('sends non-Docker environments home without pinging', async () => {
    const deps = buildOnEnterDeps();
    const endpoint = {
      Id: 9,
      Name: 'kube',
      Type: PortainerEndpointTypes.KubernetesLocalEnvironment,
      Status: EnvironmentStatus.Up,
    };

    await invokeOnEnter(endpoint, deps);

    expect(deps.$state.go).toHaveBeenCalledWith('portainer.home');
    expect(deps.SystemService.ping).not.toHaveBeenCalled();
    expect(deps.StateManager.updateEndpointState).not.toHaveBeenCalled();
  });

  it('loads a reachable local Docker environment and refreshes endpoint state', async () => {
    const deps = buildOnEnterDeps();
    const endpoint = {
      Id: 1,
      Name: 'local',
      Type: PortainerEndpointTypes.DockerEnvironment,
      Status: EnvironmentStatus.Up,
    };

    const result = await invokeOnEnter(endpoint, deps);

    expect(result).toBeUndefined();
    expect(deps.SystemService.ping).toHaveBeenCalledWith(1);
    expect(deps.EndpointService.updateEndpoint).not.toHaveBeenCalled();
    expect(endpoint.Status).toBe(EnvironmentStatus.Up);
    expect(deps.StateManager.updateEndpointState).toHaveBeenCalledWith(endpoint);
    expect(deps.$state.go).not.toHaveBeenCalled();
    expect(deps.Notifications.error).not.toHaveBeenCalled();
  });

  it('persists a status change when a local Docker environment comes back up', async () => {
    const deps = buildOnEnterDeps();
    const endpoint = {
      Id: 2,
      Name: 'local-agent',
      Type: PortainerEndpointTypes.AgentOnDockerEnvironment,
      Status: EnvironmentStatus.Down,
    };

    await invokeOnEnter(endpoint, deps);

    expect(deps.EndpointService.updateEndpoint).toHaveBeenCalledWith(2, {
      Status: EnvironmentStatus.Up,
    });
    expect(endpoint.Status).toBe(EnvironmentStatus.Up);
    expect(deps.StateManager.updateEndpointState).toHaveBeenCalledWith(endpoint);
  });

  it('cleans the provider and notifies when a local Docker environment is unreachable', async () => {
    const pingError = new Error('connection refused');
    const deps = buildOnEnterDeps({
      SystemService: { ping: vi.fn().mockRejectedValue(pingError) },
    });
    const endpoint = {
      Id: 3,
      Name: 'broken-local',
      Type: PortainerEndpointTypes.DockerEnvironment,
      Status: EnvironmentStatus.Up,
    };

    const result = await invokeOnEnter(endpoint, deps);

    expect(result).toBe(false);
    expect(endpoint.Status).toBe(EnvironmentStatus.Down);
    expect(deps.EndpointProvider.clean).toHaveBeenCalled();
    expect(deps.Notifications.error).toHaveBeenCalledWith('Failed loading environment', pingError);
    expect(deps.$state.go).toHaveBeenCalledWith(
      'portainer.home',
      {},
      { reload: true, inherit: false }
    );
    expect(deps.StateManager.updateEndpointState).not.toHaveBeenCalled();
  });

  it('builds an unreachable error when ping fails without an error object', async () => {
    const deps = buildOnEnterDeps({
      SystemService: {
        ping: vi.fn().mockImplementation(async () => {
          // Reject without a value so checkEndpointStatus returns { status: Down, error: undefined }
          // eslint-disable-next-line prefer-promise-reject-errors
          return Promise.reject();
        }),
      },
    });
    const endpoint = {
      Id: 4,
      Name: 'silent-down',
      Type: PortainerEndpointTypes.DockerEnvironment,
      Status: EnvironmentStatus.Up,
    };

    await invokeOnEnter(endpoint, deps);

    expect(deps.Notifications.error).toHaveBeenCalledWith(
      'Failed loading environment',
      expect.objectContaining({
        message: 'The environment named silent-down is unreachable.',
      })
    );
    expect(deps.EndpointProvider.clean).toHaveBeenCalled();
  });

  it('loads a reachable Edge Docker agent without persisting status', async () => {
    const deps = buildOnEnterDeps();
    const endpoint = {
      Id: 5,
      Name: 'edge-docker',
      Type: PortainerEndpointTypes.EdgeAgentOnDockerEnvironment,
      Status: EnvironmentStatus.Down,
    };

    await invokeOnEnter(endpoint, deps);

    expect(deps.SystemService.ping).toHaveBeenCalledWith(5);
    expect(deps.EndpointService.updateEndpoint).not.toHaveBeenCalled();
    expect(endpoint.Status).toBe(EnvironmentStatus.Up);
    expect(deps.StateManager.updateEndpointState).toHaveBeenCalledWith(endpoint);
  });

  it('redirects home with Edge params when an Edge Docker agent is unreachable', async () => {
    const pingError = new Error('edge tunnel down');
    const deps = buildOnEnterDeps({
      SystemService: { ping: vi.fn().mockRejectedValue(pingError) },
    });
    const endpoint = {
      Id: 6,
      Name: 'edge-offline',
      Type: PortainerEndpointTypes.EdgeAgentOnDockerEnvironment,
      Status: EnvironmentStatus.Up,
    };

    const result = await invokeOnEnter(endpoint, deps);

    expect(result).toBe(false);
    expect(deps.EndpointProvider.clean).not.toHaveBeenCalled();
    expect(deps.Notifications.error).not.toHaveBeenCalled();
    expect(deps.$state.go).toHaveBeenCalledWith(
      'portainer.home',
      {
        redirect: true,
        environmentId: 6,
        environmentName: 'edge-offline',
        route: 'docker.dashboard',
      },
      { reload: true, inherit: false }
    );
  });

  it('awaits async wrappers from $async when entering a local Docker environment', async () => {
    const ping = deferred();
    const deps = buildOnEnterDeps({
      SystemService: { ping: vi.fn(() => ping) },
      $async: (fn) => fn(),
    });
    const endpoint = {
      Id: 7,
      Name: 'async-local',
      Type: PortainerEndpointTypes.DockerEnvironment,
      Status: EnvironmentStatus.Up,
    };

    const pending = invokeOnEnter(endpoint, deps);
    expect(deps.SystemService.ping).toHaveBeenCalledWith(7);
    ping.resolve();
    await pending;
    expect(deps.StateManager.updateEndpointState).toHaveBeenCalledWith(endpoint);
  });
});
