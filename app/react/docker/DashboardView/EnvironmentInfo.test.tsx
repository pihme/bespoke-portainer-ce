import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';

import {
  ContainerEngine,
  EnvironmentType,
} from '@/react/portainer/environments/types';
import { createMockEnvironment } from '@/react-tools/test-mocks';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { createMockUser } from '@/react-tools/test-mocks';
import { server } from '@/setup-tests/server';

import { EnvironmentInfo } from './EnvironmentInfo';
import { DockerSnapshot } from '../snapshots/types';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

const currentEnvironmentState: {
  data: ReturnType<typeof createMockEnvironment> | undefined;
} = { data: undefined };

vi.mock('@/react/hooks/useCurrentEnvironment', () => ({
  useCurrentEnvironment: () => currentEnvironmentState,
}));

vi.mock('../proxy/queries/useInfo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../proxy/queries/useInfo')>();
  return {
    ...actual,
    useIsSwarmManager: vi.fn(() => false),
  };
});

import { useIsSwarmManager } from '../proxy/queries/useInfo';

function snapshot(
  overrides: Partial<DockerSnapshot> = {}
): DockerSnapshot {
  return {
    ContainerCount: 1,
    DockerVersion: '24.0.0',
    GpuUseAll: false,
    GpuUseList: [],
    HealthyContainerCount: 1,
    ImageCount: 1,
    IsPodman: false,
    NodeCount: 1,
    RunningContainerCount: 1,
    ServiceCount: 0,
    StackCount: 0,
    StoppedContainerCount: 0,
    Swarm: false,
    Time: 0,
    TotalCPU: 4,
    TotalMemory: 1073741824,
    UnhealthyContainerCount: 0,
    VolumeCount: 0,
    ...overrides,
  };
}

function renderEnvironmentInfo() {
  const Wrapped = withTestQueryProvider(
    withUserProvider(
      withTestRouter(EnvironmentInfo),
      createMockUser({ Role: 1 })
    )
  );
  return render(<Wrapped />);
}

describe('REQ-ENV-02 EnvironmentInfo', () => {
  beforeEach(() => {
    vi.mocked(useIsSwarmManager).mockReturnValue(false);
    currentEnvironmentState.data = createMockEnvironment({
      Id: 1,
      Name: 'local-docker',
      URL: 'unix:///var/run/docker.sock',
      Type: EnvironmentType.Docker,
      ContainerEngine: ContainerEngine.Docker,
      Snapshots: [snapshot()],
      TagIds: [10],
      Gpus: [{ name: 'T4' }],
    });
    server.use(
      http.get('/api/endpoints/1/docker/info', () =>
        HttpResponse.json({
          ServerVersion: '24.0.7',
          Swarm: { NodeID: '' },
        })
      ),
      http.get('/api/tags', () =>
        HttpResponse.json([{ ID: 10, Name: 'dev', Endpoints: { 1: true } }])
      )
    );
  });

  it('renders nothing while the environment is loading', () => {
    currentEnvironmentState.data = undefined;
    renderEnvironmentInfo();
    expect(
      screen.queryByRole('heading', { name: 'Environment info' })
    ).not.toBeInTheDocument();
  });

  it('shows environment name, snapshot stats, docker info, URL, GPU and tags', async () => {
    renderEnvironmentInfo();

    expect(
      await screen.findByRole('heading', { name: 'Environment info' })
    ).toBeVisible();
    expect(screen.getByText('local-docker')).toBeVisible();
    expect(screen.getByText('4')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByText(/Standalone 24.0.7/)).toBeVisible();
    });
    expect(screen.getByText('/var/run/docker.sock')).toBeVisible();
    expect(await screen.findByLabelText('GPU')).toBeVisible();
    expect(await screen.findByLabelText('Tags')).toHaveTextContent('dev');
    expect(
      screen.queryByRole('button', { name: /cluster visualizer/i })
    ).not.toBeInTheDocument();
  });

  it('hides the URL row for an Edge agent environment', async () => {
    currentEnvironmentState.data = createMockEnvironment({
      Id: 1,
      Name: 'edge-docker',
      URL: 'https://edge.example',
      Type: EnvironmentType.EdgeAgentOnDocker,
      Snapshots: [snapshot()],
      TagIds: [],
    });

    renderEnvironmentInfo();

    expect(await screen.findByText('edge-docker')).toBeVisible();
    expect(screen.queryByText('URL')).not.toBeInTheDocument();
    expect(screen.queryByText('edge.example')).not.toBeInTheDocument();
  });

  it('shows the cluster visualizer link when the node is a swarm manager', async () => {
    vi.mocked(useIsSwarmManager).mockReturnValue(true);

    renderEnvironmentInfo();

    expect(await screen.findByTestId('cluster-visualizer')).toBeVisible();
    expect(screen.getByText(/Go to cluster visualizer/i)).toBeVisible();
  });
});
