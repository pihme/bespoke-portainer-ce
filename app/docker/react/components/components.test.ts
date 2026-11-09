import { beforeEach, describe, expect, it, vi } from 'vitest';

const modules: Array<{ name: string; deps: unknown[]; components: string[] }> =
  [];

vi.mock('angular', () => ({
  default: {
    module: (name: string, deps: unknown[] = []) => {
      const entry = { name, deps, components: [] as string[] };
      modules.push(entry);
      const api = {
        name,
        component: (componentName: string) => {
          entry.components.push(componentName);
          return api;
        },
      };
      return api;
    },
  },
}));

vi.mock('@/react-tools/react2angular', () => ({
  r2a: () => ({}),
}));
vi.mock('@/react-tools/withControlledInput', () => ({
  withControlledInput: (c: unknown) => c,
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
  withFormValidation: () => undefined,
}));

// Stub heavy React leaves so importing wrappers stays light
vi.mock('@/react/docker/images/ItemView/DockerfileDetails', () => ({
  DockerfileDetails: () => null,
}));
vi.mock('@/react/docker/host/SetupView/GpusList', () => ({
  GpusList: () => null,
}));
vi.mock('@/react/docker/host/BrowseView/AgentHostBrowser', () => ({
  AgentHostBrowser: () => null,
}));
vi.mock('@/react/docker/volumes/BrowseView/AgentVolumeBrowser', () => ({
  AgentVolumeBrowser: () => null,
}));
vi.mock('@/react/docker/containers/StatsView/ProcessesDatatable', () => ({
  ProcessesDatatable: () => null,
}));
vi.mock('@/react/docker/stacks/ListView/StacksDatatable', () => ({
  StacksDatatable: () => null,
}));
vi.mock('@/react/docker/host/HostDetailsPanel/HostDetailsPanel', () => ({
  HostDetailsPanel: () => null,
}));
vi.mock('@/react/docker/volumes/ListView/VolumesDatatable', () => ({
  VolumesDatatable: () => null,
}));

describe('docker react component wrappers', () => {
  beforeEach(() => {
    modules.length = 0;
    vi.resetModules();
  });

  it('registers KEEP local Docker wrapper modules and components', async () => {
    await import('./containers');
    await import('./volumes');
    await import('./templates');
    const { componentsModule } = await import('./index');

    expect(componentsModule).toBe('portainer.docker.react.components');
    const names = modules.map((m) => m.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'portainer.docker.react.components.containers',
        'portainer.docker.react.components.volumes',
        'portainer.docker.react.components.templates',
        'portainer.docker.react.components',
      ])
    );

    const root = modules.find(
      (m) => m.name === 'portainer.docker.react.components'
    );
    expect(root?.components).toEqual(
      expect.arrayContaining([
        'dockerfileDetails',
        'gpusList',
        'dockerContainerProcessesDatatable',
        'dockerStacksDatatable',
        'hostDetailsPanel',
      ])
    );
  });

  it('REQ-TAI-003 registers no Docker Swarm wrapper modules or components', async () => {
    await import('./index');

    const names = modules.map((m) => m.name);
    expect(names).not.toContain('portainer.docker.react.components.services');
    expect(names).not.toContain('portainer.docker.react.components.swarm');
    expect(names).not.toContain('portainer.docker.react.components.networks');

    const components = modules.flatMap((m) => m.components);
    expect(
      components.filter((c) => /secret|service|swarm|node|task|config/i.test(c))
    ).toEqual([]);
  });
});
