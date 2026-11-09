import { beforeEach, describe, expect, it, vi } from 'vitest';

const { angularMock, moduleApi, components } = vi.hoisted(() => {
  const components: Array<{ name: string; def: unknown }> = [];
  const moduleApi = {
    name: '',
    component: vi.fn((name: string, def: unknown) => {
      components.push({ name, def });
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
  return { angularMock, moduleApi, components };
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
vi.mock('@/react-tools/withFormValidation', () => ({
  withFormValidation: vi.fn(),
}));
vi.mock('@/react-tools/withControlledInput', () => ({
  withControlledInput: (c: unknown) => c,
}));

// Broad mocks for React leaves used by index
vi.mock('@@/form-components/SwitchField', () => ({ SwitchField: () => null }));
vi.mock('@@/form-components/EnvironmentVariablesFieldset', () => ({
  EnvironmentVariablesFieldset: () => null,
  EnvironmentVariablesPanel: () => null,
  envVarValidation: () => ({}),
}));
vi.mock('@@/Icon', () => ({ Icon: () => null }));
vi.mock('@@/ReactQueryDevtoolsWrapper', () => ({
  ReactQueryDevtoolsWrapper: () => null,
}));
vi.mock('@@/PageHeader', () => ({ PageHeader: () => null }));
vi.mock('@@/Widget/Loading', () => ({ Loading: () => null }));
vi.mock('@@/Tip/Tooltip', () => ({ Tooltip: () => null }));
vi.mock('@@/datatables/TableHeaderCell', () => ({
  TableColumnHeaderAngular: () => null,
}));
vi.mock('@@/TerminalTooltip', () => ({ TerminalTooltip: () => null }));
vi.mock('@@/Terminal/Terminal', () => ({ Terminal: () => null }));
vi.mock('@@/form-components/PortainerSelect', () => ({
  PortainerSelect: () => null,
}));
vi.mock('@@/BETeaserButton', () => ({ BETeaserButton: () => null }));
vi.mock('@@/CodeEditor', () => ({ CodeEditor: () => null }));
vi.mock('@@/Tip/TextTip', () => ({ TextTip: () => null }));
vi.mock('@/react/portainer/gitops/GitForm', () => ({ GitForm: () => null }));
vi.mock('@/react/portainer/environments/TagsView/TagsDatatable', () => ({
  TagsDatatable: () => null,
}));

vi.mock('./custom-templates', () => ({
  customTemplatesModule: 'custom-templates',
}));

vi.mock('@@/form-components/FileUpload', () => ({ FileUploadField: () => null }));
vi.mock('./registries', () => ({ registriesModule: 'registries' }));
vi.mock('./account', () => ({ accountModule: 'account' }));

describe('portainer react components wrappers', () => {
  beforeEach(() => {
    vi.resetModules();
    components.length = 0;
    angularMock.module.mockClear();
    moduleApi.component.mockClear();
  });

  it('registers KEEP switch, git-form, stacks and environments bridges', async () => {
    const { switchField } = await import('./switch-field');
    expect(switchField).toMatchObject({
      props: expect.arrayContaining(['checked', 'onChange', 'label']),
    });

    const { gitFormModule } = await import('./git-form');
    expect(gitFormModule).toBe('portainer.app.components.forms.git');
    expect(components.map((c) => c.name)).toContain('reactGitForm');

    components.length = 0;
    const { stacksModule } = await import('./stacks');
    expect(stacksModule).toBe('portainer.app.react.components.stacks');

    const { environmentsModule } = await import('./environments');
    expect(environmentsModule).toBe(
      'portainer.app.react.components.environments'
    );
    expect(components.map((c) => c.name)).toContain('tagsDatatable');
  });

  it('aggregates KEEP parent components module', async () => {
    const { ngModule } = await import('./index');
    expect(
      typeof ngModule === 'string' ? ngModule : (ngModule as { name: string }).name
    ).toBe('portainer.app.react.components');
    expect(angularMock.module).toHaveBeenCalledWith(
      'portainer.app.react.components',
      expect.arrayContaining([
        'portainer.app.components.forms.git',
        'portainer.app.react.components.stacks',
        'portainer.app.react.components.environments',
      ])
    );
    expect(components.map((c) => c.name)).toEqual(
      expect.arrayContaining(['porSwitchField', 'fileUploadField'])
    );
  });

  it('REQ-TAI-001 registers no login, user or access-control components', async () => {
    await import('./index');
    const calls = angularMock.module.mock.calls as unknown as Array<
      [string, string[]]
    >;
    const [, deps] = calls.find(
      ([name]) => name === 'portainer.app.react.components'
    )!;
    for (const gone of ['users', 'rbac', 'auth', 'settings']) {
      expect(deps).not.toContain(gone);
    }
    const names = components.map((c) => c.name);
    for (const gone of [
      'passwordCheckHint',
      'accessControlPanel',
      'porAccessControlFormTeamSelector',
      'porAccessControlFormUserSelector',
      'porAccessManagementUsersSelector',
      'accessTypeSelector',
      'authenticationLogsTable',
    ]) {
      expect(names).not.toContain(gone);
    }
  });

  it('REQ-TAI-002 registers no Kubernetes components', async () => {
    await import('./index');
    const names = components.map((c) => c.name);
    expect(names).not.toContain('annotationsBeTeaser');
  });
});
