import { beforeEach, describe, expect, it, vi } from 'vitest';

const { angularMock, moduleApi, components, factories, configs, registeredStates } =
  vi.hoisted(() => {
    const components: Array<{ name: string; def: unknown }> = [];
    const factories: Array<{ name: string; def: unknown }> = [];
    const configs: unknown[] = [];
    const registeredStates: unknown[] = [];
    const moduleApi = {
      name: '',
      component: vi.fn((name: string, def: unknown) => {
        components.push({ name, def });
        return moduleApi;
      }),
      factory: vi.fn((name: string, def: unknown) => {
        factories.push({ name, def });
        return moduleApi;
      }),
      config: vi.fn((fn: unknown) => {
        configs.push(fn);
        return moduleApi;
      }),
    };
    const angularMock = {
      module: vi.fn((name: string) => {
        moduleApi.name = name;
        return moduleApi;
      }),
    };
    globalThis.angular = angularMock as never;
    return {
      angularMock,
      moduleApi,
      components,
      factories,
      configs,
      registeredStates,
    };
  });

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('@/react-tools/react2angular', () => ({
  r2a: vi.fn((Component: unknown, props: string[]) => ({ Component, props })),
}));

vi.mock('@/react-tools/withCurrentUser', () => ({
  withCurrentUser: (c: unknown) => c,
}));
vi.mock('@/react-tools/withReactQuery', () => ({
  withReactQuery: (c: unknown) => c,
}));
vi.mock('@/react-tools/withUIRouter', () => ({
  withUIRouter: (c: unknown) => c,
}));

vi.mock('@/react/portainer/HomeView', () => ({ HomeView: () => null }));
vi.mock('@/react/portainer/settings/EdgeComputeView/EdgeComputeSettingsView', () => ({
  EdgeComputeSettingsView: () => null,
}));
vi.mock('@/react/portainer/init/InitEdgeView/InitEdgeView', () => ({
  InitEdgeView: () => null,
}));
vi.mock('@/react/portainer/settings/SettingsView/SettingsView', () => ({
  SettingsView: () => null,
}));
vi.mock('@/react/portainer/environments/wizard', () => ({
  EnvironmentCreationView: () => null,
  EnvironmentTypeSelectView: () => null,
  HomeView: () => null,
}));
vi.mock('@/react/portainer/environments/environment-groups/ListView', () => ({
  ListView: () => null,
}));
vi.mock(
  '@/react/portainer/environments/environment-groups/ItemView/EditGroupView',
  () => ({ EditGroupView: () => null })
);
vi.mock(
  '@/react/portainer/environments/environment-groups/CreateView/CreateGroupView',
  () => ({ CreateGroupView: () => null })
);
vi.mock('@/react/portainer/environments/ListView', () => ({ ListView: () => null }));
vi.mock('@/react/portainer/environments/ItemView/ItemView', () => ({
  ItemView: () => null,
}));
vi.mock(
  '@/react/portainer/environments/EdgeAutoCreateScriptView/EdgeAutoCreateScriptView',
  () => ({ EdgeAutoCreateScriptViewWrapper: () => null })
);
vi.mock('@/react/portainer/gitops/workflows/ListView/ListView', () => ({
  ListView: () => null,
}));
vi.mock('@/react/portainer/gitops/workflows/ItemView/ItemView', () => ({
  ItemView: () => null,
}));
vi.mock('@/react/portainer/gitops/sources/ListView/ListView', () => ({
  ListView: () => null,
}));
vi.mock('@/react/portainer/gitops/sources/ItemView/ItemView', () => ({
  ItemView: () => null,
}));
vi.mock('@/react/portainer/gitops/sources/CreateView/CreateView', () => ({
  CreateView: () => null,
}));
vi.mock('@/react/portainer/templates/custom-templates/CreateView', () => ({
  CreateView: () => null,
}));
vi.mock('@/react/portainer/templates/custom-templates/EditView', () => ({
  EditView: () => null,
}));
vi.mock('@/react/portainer/templates/app-templates/AppTemplatesView', () => ({
  AppTemplatesView: () => null,
}));
vi.mock('@/react/portainer/templates/custom-templates/ListView/ListView', () => ({
  ListView: () => null,
}));
vi.mock('@/react/portainer/logs/ActivityLogsView/ActivityLogsView', () => ({
  ActivityLogsView: () => null,
}));
vi.mock('@/react/sidebar/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('@/react/sidebar/useSidebarState', () => ({
  AngularSidebarService: () => ({}),
}));
vi.mock('@/react/portainer/registries/ListView', () => ({ ListView: () => null }));
vi.mock('@/react/portainer/registries/environments/ListView', () => ({
  ListView: () => null,
}));
vi.mock('@/react/portainer/environments/update-schedules', () => ({
  ListView: () => null,
  CreateView: () => null,
  ItemView: () => null,
}));
vi.mock('@/portainer/authorization-guard', () => ({
  AccessHeaders: { Admin: 'admin', Restricted: 'restricted' },
}));

describe('portainer react view wrappers', () => {
  beforeEach(() => {
    vi.resetModules();
    components.length = 0;
    factories.length = 0;
    configs.length = 0;
    registeredStates.length = 0;
    angularMock.module.mockClear();
    moduleApi.component.mockClear();
    moduleApi.factory.mockClear();
    moduleApi.config.mockClear();
  });

  it('registers KEEP wizard environment creation views and routes', async () => {
    const { wizardModule } = await import('./wizard');
    expect(wizardModule).toBe('portainer.app.react.views.wizard');
    expect(components.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        'wizardEnvironmentCreationView',
        'wizardEnvironmentTypeSelectView',
        'wizardMainView',
      ])
    );
    expect(configs).toHaveLength(1);
    const $stateRegistryProvider = {
      register: vi.fn((state: unknown) => registeredStates.push(state)),
    };
    (configs[0] as (p: typeof $stateRegistryProvider) => void)(
      $stateRegistryProvider
    );
    expect($stateRegistryProvider.register).toHaveBeenCalled();
    expect(registeredStates.map((s) => (s as { name: string }).name)).toEqual([
      'portainer.wizard',
      'portainer.wizard.endpoints',
      'portainer.wizard.endpoints.create',
    ]);
  });

  it('registers KEEP templates, gitops, environments and env-group views', async () => {
    const { templatesModule } = await import('./templates');
    expect(templatesModule).toBe('portainer.app.react.views.templates');
    expect(components.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        'appTemplatesView',
        'customTemplatesView',
        'createCustomTemplatesView',
        'editCustomTemplatesView',
      ])
    );

    components.length = 0;
    const { gitopsViewsModule } = await import('./gitops');
    expect(gitopsViewsModule).toBe('portainer.app.react.views.gitops');
    expect(components.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        'workflowsView',
        'workflowItemView',
        'sourcesListView',
        'sourceItemView',
        'sourceCreateView',
      ])
    );

    components.length = 0;
    const { environmentsModule } = await import('./environments');
    expect(environmentsModule).toBe('portainer.app.react.views.environments');
    expect(components.map((c) => c.name)).toEqual(
      expect.arrayContaining(['environmentsListView', 'environmentsItemView'])
    );

    components.length = 0;
    const { environmentGroupModule } = await import('./env-groups');
    expect(environmentGroupModule).toBe(
      'portainer.app.react.views.environment-groups'
    );
    expect(components.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        'environmentGroupsListView',
        'environmentGroupEditView',
        'environmentGroupCreateView',
      ])
    );
  });

  it('registers KEEP sidebar, activity logs and aggregates viewsModule', async () => {
    const { sidebarModule } = await import('./sidebar');
    expect(sidebarModule).toBe('portainer.app.sidebar');
    expect(components.map((c) => c.name)).toContain('sidebar');
    expect(factories.map((f) => f.name)).toContain('SidebarService');

    components.length = 0;
    const { activityLogsModule } = await import('./activity-logs');
    expect(activityLogsModule).toBe('portainer.app.react.views.activity-logs');
    expect(components.map((c) => c.name)).toContain('activityLogsView');

    components.length = 0;
    const { viewsModule } = await import('./index');
    expect(viewsModule).toBe('portainer.app.react.views');
    expect(angularMock.module).toHaveBeenCalledWith(
      'portainer.app.react.views',
      expect.arrayContaining([
        'portainer.app.react.views.wizard',
        'portainer.app.react.views.templates',
        'portainer.app.react.views.gitops',
        'portainer.app.react.views.environments',
      ])
    );
    expect(components.map((c) => c.name)).toEqual(
      expect.arrayContaining(['homeView', 'settingsView'])
    );
  });

  it('REQ-TAI-001 registers no login, user, team or token views', async () => {
    await import('./index');
    const names = components.map((c) => c.name);
    for (const gone of [
      'usersListView',
      'teamsView',
      'teamView',
      'createUserAccessToken',
    ]) {
      expect(names).not.toContain(gone);
    }
  });

  it('REQ-TAI-002 registers no Helm repository view', async () => {
    await import('./index');
    const names = components.map((c) => c.name);
    expect(names).not.toContain('createHelmRepositoryView');
  });
});
