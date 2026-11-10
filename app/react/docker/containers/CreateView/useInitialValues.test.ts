import { renderHook } from '@testing-library/react-hooks';
import { describe, expect, it, vi } from 'vitest';

const { stub } = vi.hoisted(() => ({
  stub: (name: string) => ({
    toViewModel: () => ({ stub: name }),
    getDefaultViewModel: () => ({ stub: name }),
  }),
}));

vi.mock('@uirouter/react', () => ({
  useCurrentStateAndParams: () => ({
    params: { nodeName: '', from: 'c-from' },
  }),
}));
vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));
vi.mock('@/react/portainer/environments/queries/useIsPodman', () => ({
  useIsPodman: () => false,
}));
vi.mock('../components/NetworkSelector', () => ({
  useNetworksForSelector: () => ({ data: [] }),
}));
vi.mock('../queries/useContainer', () => ({
  useContainer: () => ({
    data: {
      Id: 'c-from',
      Name: '/web',
      Config: { Image: 'nginx:latest' },
      HostConfig: {},
      NetworkSettings: { Networks: {} },
    },
  }),
}));
vi.mock('../queries/useContainers', () => ({
  useContainers: () => ({ data: [] }),
}));
vi.mock('@/react/docker/containers/CreateView/BaseForm', () => ({
  baseFormUtils: {
    toViewModel: () => ({ name: 'web' }),
    getDefaultViewModel: () => ({ name: '' }),
  },
}));
vi.mock('@/react/docker/containers/CreateView/CapabilitiesTab', () => ({
  capabilitiesTabUtils: stub('capabilities'),
}));
vi.mock('@/react/docker/containers/CreateView/CommandsTab', () => ({
  commandsTabUtils: stub('commands'),
}));
vi.mock('@/react/docker/containers/CreateView/LabelsTab', () => ({
  labelsTabUtils: stub('labels'),
}));
vi.mock('@/react/docker/containers/CreateView/NetworkTab', () => ({
  networkTabUtils: {
    toViewModel: () => ({ networkMode: 'bridge' }),
    getDefaultViewModel: () => ({ networkMode: 'bridge' }),
  },
}));
vi.mock('@/react/docker/containers/CreateView/ResourcesTab', () => ({
  resourcesTabUtils: stub('resources'),
}));
vi.mock('@/react/docker/containers/CreateView/RestartPolicyTab', () => ({
  restartPolicyTabUtils: stub('restartPolicy'),
}));
vi.mock('@/react/docker/containers/CreateView/VolumesTab', () => ({
  volumesTabUtils: stub('volumes'),
}));
vi.mock('@/react/docker/containers/CreateView/EnvVarsTab', () => ({
  envVarsTabUtils: stub('env'),
}));
vi.mock('@/docker/models/containerDetails', () => ({
  ContainerDetailsViewModel: class {},
}));
vi.mock('./NetworkTab/toViewModel', () => ({
  getDefaultNetworkMode: () => 'bridge',
}));

import { useInitialValues } from './useInitialValues';

describe('REQ-TAI-014 useInitialValues when duplicating a container', () => {
  it('builds the duplicate form without waiting for container webhooks', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { result } = renderHook(() => useInitialValues(false, false));

    expect(result.current).not.toBeNull();
    expect(result.current?.isDuplicating).toBe(true);
    expect(result.current?.initialValues.name).toBe('web');
    expect(result.current?.initialValues).not.toHaveProperty('enableWebhook');
    expect(
      fetchSpy.mock.calls.filter(([url]) => String(url).includes('webhooks'))
    ).toEqual([]);

    fetchSpy.mockRestore();
  });
});
