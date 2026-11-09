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
vi.mock('@/react/docker/secrets/ListView/SecretsDatatable', () => ({
  SecretsDatatable: () => null,
}));
vi.mock('@/react/docker/stacks/ListView/StacksDatatable', () => ({
  StacksDatatable: () => null,
}));
vi.mock('@/react/docker/host/HostDetailsPanel/HostDetailsPanel', () => ({
  HostDetailsPanel: () => null,
}));
vi.mock(
  '@/react/docker/networks/CreateView/MacvlanNodesSelector/MacvlanNodesSelector',
  () => ({ MacvlanNodesSelector: () => null })
);
vi.mock('@/react/docker/services/ListView/ServicesDatatable', () => ({
  ServicesDatatable: () => null,
}));
vi.mock('@/react/docker/services/ItemView/TasksDatatable', () => ({
  TasksDatatable: () => null,
}));
vi.mock('@/react/docker/services/ItemView/PortMappingField', () => ({
  PortsMappingField: () => null,
  portsMappingUtils: { validation: () => ({}) },
}));
vi.mock('@/react/docker/swarm/SwarmView/NodesDatatable', () => ({
  NodesDatatable: () => null,
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
    await import('./networks');
    await import('./volumes');
    await import('./templates');
    const { componentsModule } = await import('./index');

    expect(componentsModule).toBe('portainer.docker.react.components');
    const names = modules.map((m) => m.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'portainer.docker.react.components.containers',
        'portainer.docker.react.components.networks',
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
});
