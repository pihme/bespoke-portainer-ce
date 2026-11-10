vi.mock('@/react/portainer/feature-flags', () => ({
  default: 'featureFlagModule',
}));
vi.mock('./rbac', () => ({}));
vi.mock('./components', () => ({ default: 'componentsModule' }));
vi.mock('./settings', () => ({ default: 'settingsModule' }));
vi.mock('./user-activity', () => ({ default: 'userActivityModule' }));
vi.mock('./services', () => ({ default: 'servicesModule' }));
vi.mock('./react', () => ({ reactModule: 'reactModule' }));
vi.mock('./react/views/sidebar', () => ({ sidebarModule: 'sidebarModule' }));
vi.mock('./environments', () => ({ default: 'environmentsModule' }));
vi.mock('./helpers', () => ({ helpersModule: 'helpersModule' }));
vi.mock('./authorization-guard', () => ({
  AccessHeaders: {
    Restricted: 'restricted',
    Admin: 'admin',
    EdgeAdmin: 'edge-admin',
  },
  requiresAuthHook: vi.fn(),
}));
vi.mock('./helpers/stateParamHelper', () => ({
  filterParam: (defaultValue) => ({ value: defaultValue }),
  paginationParams: () => ({
    page: { value: '1' },
    pageSize: { value: '10' },
  }),
}));

const registeredStates = [];
const moduleApi = {
  config: vi.fn(function config(arg) {
    moduleApi._configArg = arg;
    return moduleApi;
  }),
  run: vi.fn(function run(arg) {
    moduleApi._runArg = arg;
    return moduleApi;
  }),
};

globalThis.angular = {
  module: vi.fn(() => moduleApi),
};

const { requiresAuthHook } = await import('./authorization-guard');

await import('./__module.js');

function getConfigFn() {
  const arg = moduleApi._configArg;
  expect(Array.isArray(arg)).toBe(true);
  expect(arg[0]).toBe('$stateRegistryProvider');
  return arg[1];
}

function registerStates() {
  registeredStates.length = 0;
  const registry = {
    register: vi.fn((state) => {
      registeredStates.push(state);
      return state;
    }),
  };
  getConfigFn()(registry);
  return registry;
}

function stateByName(name) {
  const state = registeredStates.find((s) => s.name === name);
  expect(state, `missing state ${name}`).toBeTruthy();
  return state;
}

describe('portainer.app module', () => {
  it('registers portainer.app with local app dependency modules', () => {
    expect(globalThis.angular.module).toHaveBeenCalledWith(
      'portainer.app',
      expect.arrayContaining([
        'componentsModule',
        'settingsModule',
        'featureFlagModule',
        'userActivityModule',
        'servicesModule',
        'reactModule',
        'sidebarModule',
        'environmentsModule',
        'helpersModule',
      ])
    );
  });

  it('REQ-TAI-001 does not depend on the oauth or rbac modules', () => {
    const call = globalThis.angular.module.mock.calls.find(
      ([name, deps]) => name === 'portainer.app' && Array.isArray(deps)
    );
    expect(call[1]).not.toContain('portainer.oauth');
    expect(call[1]).not.toContain('portainer.rbac');
  });

  it('wires requiresAuthHook in the module run block', () => {
    const runFn = moduleApi._runArg;
    expect(typeof runFn).toBe('function');
    const transitions = { onBefore: vi.fn() };
    runFn(transitions);
    expect(requiresAuthHook).toHaveBeenCalledWith(transitions);
  });
});

describe('portainer.app local-docker UI-Router states', () => {
  beforeEach(() => {
    registerStates();
  });

  it('registers root, endpoint, home, endpoints, gitops and settings', () => {
    const names = registeredStates.map((s) => s.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'root',
        'endpoint',
        'portainer',
        'portainer.home',
        'portainer.endpoints',
        'portainer.endpoints.endpoint',
        'portainer.gitops',
        'portainer.gitops.sources',
        'portainer.gitops.sources.item',
        'portainer.gitops.sources.new',
        'portainer.settings',
      ])
    );
  });

  it('REQ-TAI-013 registers no environment group or tag states', () => {
    const names = registeredStates.map((s) => s.name);
    expect(names.filter((n) => /^portainer\.(groups|tags)\b/.test(n))).toEqual(
      []
    );
  });

  it('REQ-TAI-001 registers no login, user, team or auth-settings states', () => {
    const names = registeredStates.map((s) => s.name);
    for (const gone of [
      'portainer.auth',
      'portainer.logout',
      'portainer.init.admin',
      'portainer.users',
      'portainer.users.user',
      'portainer.teams',
      'portainer.roles',
      'portainer.settings.authentication',
      'portainer.account.tokens',
      'portainer.endpoints.endpoint.access',
      'portainer.authLogs',
    ]) {
      expect(names).not.toContain(gone);
    }
  });

  it('REQ-TAI-005 registers no registry states and no registry management module', () => {
    const names = registeredStates.map((s) => s.name);
    expect(names.filter((n) => /registr/i.test(n))).toEqual([]);
    const call = globalThis.angular.module.mock.calls.find(
      ([name, deps]) => name === 'portainer.app' && Array.isArray(deps)
    );
    expect(call[1]).not.toContain('portainer.registrymanagement');
  });

  it('REQ-TAI-002 registers no Helm repository state', () => {
    const names = registeredStates.map((s) => s.name);
    expect(names).not.toContain('portainer.account.createHelmRepository');
  });

  it('marks root restricted with sidebar and endpoint under root', () => {
    const root = stateByName('root');
    expect(root.abstract).toBe(true);
    expect(root.data.access).toBe('restricted');
    expect(root.views['sidebar@'].component).toBe('sidebar');

    const endpoint = stateByName('endpoint');
    expect(endpoint.parent).toBe('root');
    expect(endpoint.url).toBe('/:endpointId');
    expect(endpoint.abstract).toBe(true);
    expect(typeof endpoint.resolve.endpoint).toBe('function');
  });

  it('configures home, endpoints list/item and settings root', () => {
    expect(stateByName('portainer.home').views['content@'].component).toBe(
      'homeView'
    );
    expect(stateByName('portainer.endpoints').views['content@'].component).toBe(
      'environmentsListView'
    );
    expect(
      stateByName('portainer.endpoints.endpoint').views['content@'].component
    ).toBe('environmentsItemView');

    const settings = stateByName('portainer.settings');
    expect(settings.data.access).toBe('admin');
    expect(settings.views['content@'].component).toBe('settingsView');
  });

  it('configures gitops sources under an abstract gitops parent', () => {
    expect(stateByName('portainer.gitops').abstract).toBe(true);
    expect(
      stateByName('portainer.gitops.sources').views['content@'].component
    ).toBe('sourcesListView');
    expect(
      stateByName('portainer.gitops.sources.item').views['content@'].component
    ).toBe('sourceItemView');
    expect(
      stateByName('portainer.gitops.sources.new').views['content@'].component
    ).toBe('sourceCreateView');
  });

  it('REQ-TAI-011 registers no GitOps workflows states', () => {
    expect(
      registeredStates.filter((s) => s.name.startsWith('portainer.gitops.workflows'))
    ).toEqual([]);
  });
});

describe('endpoint resolve', () => {
  beforeEach(() => {
    registerStates();
  });

  function makeAsync($async) {
    return (fn) => fn();
  }

  it('loads a numeric local endpoint id and sets the current endpoint', async () => {
    const resolveFn = stateByName('endpoint').resolve.endpoint;
    const endpoint = { Id: 3, Type: 1, EdgeID: '' };
    const EndpointService = {
      endpoint: vi.fn().mockResolvedValue(endpoint),
    };
    const EndpointProvider = {
      setCurrentEndpoint: vi.fn(),
    };
    const $state = { go: vi.fn() };
    const Notifications = { error: vi.fn() };
    const $transition$ = {
      params: () => ({ endpointId: '3' }),
    };

    const result = await resolveFn(
      makeAsync(),
      $state,
      $transition$,
      EndpointProvider,
      EndpointService,
      Notifications
    );

    expect(EndpointService.endpoint).toHaveBeenCalledWith(3);
    expect(EndpointProvider.setCurrentEndpoint).toHaveBeenCalledWith(endpoint);
    expect(result).toBe(endpoint);
    expect($state.go).not.toHaveBeenCalled();
  });

  it('REQ-TAI-004 no longer redirects Edge endpoints to the Edge key page', async () => {
    const resolveFn = stateByName('endpoint').resolve.endpoint;
    const endpoint = { Id: 7, Type: 4, EdgeID: '' };
    const EndpointService = {
      endpoint: vi.fn().mockResolvedValue(endpoint),
    };
    const EndpointProvider = {
      setCurrentEndpoint: vi.fn(),
    };
    const $state = { go: vi.fn() };

    const result = await resolveFn(
      makeAsync(),
      $state,
      { params: () => ({ endpointId: '7' }) },
      EndpointProvider,
      EndpointService,
      { error: vi.fn() }
    );

    expect($state.go).not.toHaveBeenCalled();
    expect(EndpointProvider.setCurrentEndpoint).toHaveBeenCalledWith(endpoint);
    expect(result).toBe(endpoint);
  });

  it('notifies and redirects home when the endpoint is missing', async () => {
    const resolveFn = stateByName('endpoint').resolve.endpoint;
    const err = new Error('missing');
    const EndpointService = {
      endpoint: vi.fn().mockRejectedValue(err),
    };
    const EndpointProvider = {
      setCurrentEndpoint: vi.fn(),
    };
    const $state = { go: vi.fn() };
    const Notifications = { error: vi.fn() };

    const result = await resolveFn(
      makeAsync(),
      $state,
      { params: () => ({ endpointId: '99' }) },
      EndpointProvider,
      EndpointService,
      Notifications
    );

    expect(Notifications.error).toHaveBeenCalledWith(
      'Failed loading environment',
      err
    );
    expect($state.go).toHaveBeenCalledWith(
      'portainer.home',
      {},
      { reload: true }
    );
    expect(result).toBeUndefined();
  });
});

describe('root onEnter', () => {
  beforeEach(() => {
    registerStates();
  });

  function makeAsync() {
    return (fn) => fn();
  }

  it('returns early when the app is already loaded', async () => {
    const onEnter = stateByName('root').onEnter;
    const StateManager = {
      getState: vi.fn().mockReturnValue({ loading: false }),
      initialize: vi.fn(),
    };
    const Authentication = { init: vi.fn() };
    const Notifications = { error: vi.fn() };
    const $state = { go: vi.fn(), transition: null };

    await onEnter(
      makeAsync(),
      StateManager,
      Authentication,
      Notifications,
      $state
    );

    expect(Authentication.init).not.toHaveBeenCalled();
    expect(StateManager.initialize).not.toHaveBeenCalled();
  });

  it('initializes state after authentication when already loading', async () => {
    const onEnter = stateByName('root').onEnter;
    const StateManager = {
      getState: vi.fn().mockReturnValue({ loading: true }),
      initialize: vi.fn().mockResolvedValue(undefined),
    };
    const Authentication = { init: vi.fn().mockResolvedValue(true) };
    const Notifications = { error: vi.fn() };
    const $state = { go: vi.fn(), transition: null };

    await onEnter(
      makeAsync(),
      StateManager,
      Authentication,
      Notifications,
      $state
    );

    expect(Authentication.init).toHaveBeenCalled();
    expect(StateManager.initialize).toHaveBeenCalled();
    expect($state.go).not.toHaveBeenCalled();
  });

  it('REQ-TAI-001 never redirects to a login or logout route', async () => {
    const onEnter = stateByName('root').onEnter;
    const StateManager = {
      getState: vi.fn().mockReturnValue({ loading: true }),
      initialize: vi.fn().mockResolvedValue(undefined),
    };
    const Authentication = { init: vi.fn().mockResolvedValue(true) };
    const Notifications = { error: vi.fn() };
    const $state = {
      go: vi.fn(),
      transition: { to: () => ({ name: 'portainer.home' }) },
    };

    await onEnter(
      makeAsync(),
      StateManager,
      Authentication,
      Notifications,
      $state
    );

    expect($state.go).not.toHaveBeenCalled();
    expect(StateManager.initialize).toHaveBeenCalled();
  });

  it('surfaces initialization failures through Notifications', async () => {
    const onEnter = stateByName('root').onEnter;
    const err = new Error('settings boom');
    const StateManager = {
      getState: vi.fn().mockReturnValue({ loading: true }),
      initialize: vi.fn().mockRejectedValue(err),
    };
    const Authentication = { init: vi.fn().mockResolvedValue(true) };
    const Notifications = { error: vi.fn() };
    const $state = { go: vi.fn(), transition: null };

    await expect(
      onEnter(makeAsync(), StateManager, Authentication, Notifications, $state)
    ).rejects.toBe(err);
    expect(Notifications.error).toHaveBeenCalledWith(
      'Failure',
      err,
      'Unable to retrieve application settings'
    );
  });
});
