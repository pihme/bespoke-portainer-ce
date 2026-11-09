import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import {
  ContainerEngine,
  Environment,
  EnvironmentType,
} from '@/react/portainer/environments/types';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useConnectLocalEnvironment } from './useFetchOrCreateLocalEnvironment';

const createLocalDockerEnvironment = vi.fn();
const createLocalKubernetesEnvironment = vi.fn();

let environmentList: {
  environments: Environment[];
  isLoading: boolean;
} = { environments: [], isLoading: false };

vi.mock('@/react/portainer/environments/queries/useEnvironmentList', () => ({
  useEnvironmentList: () => environmentList,
}));

vi.mock('@/react/portainer/environments/environment.service/create', () => ({
  createLocalDockerEnvironment: (...args: unknown[]) =>
    createLocalDockerEnvironment(...args),
  createLocalKubernetesEnvironment: (...args: unknown[]) =>
    createLocalKubernetesEnvironment(...args),
}));

function renderConnectHook() {
  return renderHook(() => useConnectLocalEnvironment(), {
    wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
  });
}

describe('REQ-ENV-04 useConnectLocalEnvironment', () => {
  beforeEach(() => {
    environmentList = { environments: [], isLoading: false };
    createLocalDockerEnvironment.mockReset();
    createLocalKubernetesEnvironment.mockReset();
  });

  it('reuses an existing local Docker environment', async () => {
    environmentList = {
      isLoading: false,
      environments: [
        {
          Id: 2,
          Name: 'local',
          Type: EnvironmentType.Docker,
        } as Environment,
      ],
    };

    const { result } = renderConnectHook();

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.type).toBe(EnvironmentType.Docker);
    expect(createLocalDockerEnvironment).not.toHaveBeenCalled();
  });

  it('accepts the primary agent environment only when id is 1', async () => {
    environmentList = {
      isLoading: false,
      environments: [
        {
          Id: 1,
          Name: 'primary',
          Type: EnvironmentType.AgentOnDocker,
        } as Environment,
      ],
    };

    const { result } = renderConnectHook();
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.type).toBe(EnvironmentType.AgentOnDocker);
  });

  it('ignores non-primary agent environments and creates a local docker one', async () => {
    environmentList = {
      isLoading: false,
      environments: [
        {
          Id: 9,
          Name: 'other-agent',
          Type: EnvironmentType.AgentOnDocker,
        } as Environment,
      ],
    };
    createLocalKubernetesEnvironment.mockRejectedValue(new Error('no k8s'));
    createLocalDockerEnvironment
      .mockRejectedValueOnce(new Error('no podman'))
      .mockResolvedValueOnce({
        Id: 3,
        Name: 'local',
        Type: EnvironmentType.Docker,
      });

    const { result } = renderConnectHook();
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(createLocalDockerEnvironment).toHaveBeenCalledWith({
      name: 'local',
      containerEngine: ContainerEngine.Docker,
    });
    expect(result.current.type).toBe(EnvironmentType.Docker);
  });

  it('stays loading while the environment list is loading', () => {
    environmentList = { environments: [], isLoading: true };
    const { result } = renderConnectHook();
    expect(result.current.status).toBe('loading');
  });

  it('surfaces an error when every create attempt fails', async () => {
    const restore = suppressConsoleLogs();
    createLocalKubernetesEnvironment.mockRejectedValue(new Error('no k8s'));
    createLocalDockerEnvironment.mockRejectedValue(new Error('no docker'));

    const { result } = renderConnectHook();
    await waitFor(() => expect(result.current.status).toBe('error'));
    restore();
  });
});
