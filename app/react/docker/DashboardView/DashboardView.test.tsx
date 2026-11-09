import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { EnvironmentType } from '@/react/portainer/environments/types';
import { createMockEnvironment, createMockUser } from '@/react-tools/test-mocks';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';

import { DashboardView } from './DashboardView';

const envState: {
  data: ReturnType<typeof createMockEnvironment> | undefined;
} = {
  data: undefined,
};

const dashboardState: {
  data:
    | {
        containers: {
          total: number;
          running: number;
          stopped: number;
          healthy: number;
          unhealthy: number;
        };
        services: number;
        images: { total: number; size: number };
        volumes: number;
        networks: number;
        stacks: number;
      }
    | undefined;
} = {
  data: undefined,
};

let isEnvAdmin = true;
let isSwarmManager = false;
let isSwarm = false;

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@/react/hooks/useCurrentEnvironment', () => ({
  useCurrentEnvironment: () => envState,
}));

vi.mock('@/react/hooks/useUser', async (importOriginal: () => Promise<object>) => {
  const actual = await importOriginal<typeof import('@/react/hooks/useUser')>();
  return {
    ...actual,
    useIsEnvironmentAdmin: () => ({ authorized: isEnvAdmin }),
  };
});

vi.mock('../proxy/queries/useInfo', () => ({
  useIsSwarmManager: () => isSwarmManager,
  useIsSwarm: () => isSwarm,
  useInfo: () => ({ data: undefined }),
}));

vi.mock('./useDashboard', () => ({
  useDashboard: () => dashboardState,
}));

vi.mock('./EnvironmentInfo', () => ({
  EnvironmentInfo: () => <div data-cy="env-info-stub">Environment info</div>,
}));

vi.mock('./NonAgentSwarmInfo', () => ({
  NonAgentSwarmInfo: () => <div data-cy="non-agent-swarm">Non-agent swarm</div>,
}));

vi.mock('./ClusterAgentInfo', () => ({
  ClusterAgentInfo: () => <div data-cy="cluster-agent">Cluster agent</div>,
}));

const defaultStats = {
  containers: {
    total: 5,
    running: 3,
    stopped: 2,
    healthy: 2,
    unhealthy: 1,
  },
  services: 7,
  images: { total: 4, size: 2048 },
  volumes: 2,
  networks: 3,
  stacks: 1,
};

function renderDashboard() {
  const Wrapped = withTestQueryProvider(
    withUserProvider(
      withTestRouter(DashboardView),
      createMockUser({ Role: 1 })
    )
  );
  return render(<Wrapped />);
}

describe('Docker DashboardView', () => {
  beforeEach(() => {
    isEnvAdmin = true;
    isSwarmManager = false;
    isSwarm = false;
    envState.data = createMockEnvironment({
      Id: 1,
      Name: 'local',
      Type: EnvironmentType.Docker,
      EnableGPUManagement: false,
      Gpus: [],
      SecuritySettings: {
        allowBindMountsForRegularUsers: false,
        allowPrivilegedModeForRegularUsers: false,
        allowContainerCapabilitiesForRegularUsers: false,
        allowDeviceMappingForRegularUsers: false,
        allowHostNamespaceForRegularUsers: false,
        allowStackManagementForRegularUsers: false,
        allowSysctlSettingForRegularUsers: false,
        allowSecurityOptForRegularUsers: false,
        allowVolumeBrowserForRegularUsers: false,
        enableHostManagementFeatures: false,
      },
    });
    dashboardState.data = { ...defaultStats };
  });

  it('renders nothing while environment or dashboard stats are missing', () => {
    envState.data = undefined;
    const { rerender } = renderDashboard();
    expect(
      screen.queryByRole('heading', { name: 'Dashboard' })
    ).not.toBeInTheDocument();

    envState.data = createMockEnvironment({
      Id: 1,
      Type: EnvironmentType.Docker,
    });
    dashboardState.data = undefined;
    const Wrapped = withTestQueryProvider(
      withUserProvider(
        withTestRouter(DashboardView),
        createMockUser({ Role: 1 })
      )
    );
    rerender(<Wrapped />);
    expect(
      screen.queryByRole('heading', { name: 'Dashboard' })
    ).not.toBeInTheDocument();
  });

  it('shows the local Docker resource overview and environment info', async () => {
    renderDashboard();

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' })
    ).toBeVisible();
    expect(screen.getByText('Environment summary')).toBeVisible();
    expect(screen.getByTestId('env-info-stub')).toBeVisible();

    expect(screen.getByLabelText('Container')).toBeVisible();
    expect(screen.getByLabelText('Image')).toBeVisible();
    expect(screen.getByLabelText('Volume')).toBeVisible();
    expect(screen.getByLabelText('Network')).toBeVisible();
    expect(screen.getByLabelText('Stack')).toBeVisible();

    expect(screen.getByText('3 running')).toBeVisible();
    expect(screen.getByText('2 stopped')).toBeVisible();
    expect(screen.queryByLabelText('Service')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('GPU')).not.toBeInTheDocument();
    expect(screen.queryByTestId('non-agent-swarm')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cluster-agent')).not.toBeInTheDocument();
  });

  it('hides stacks for a regular user when stack management is disabled', async () => {
    isEnvAdmin = false;
    envState.data = createMockEnvironment({
      Id: 1,
      Type: EnvironmentType.Docker,
      SecuritySettings: {
        allowBindMountsForRegularUsers: false,
        allowPrivilegedModeForRegularUsers: false,
        allowContainerCapabilitiesForRegularUsers: false,
        allowDeviceMappingForRegularUsers: false,
        allowHostNamespaceForRegularUsers: false,
        allowStackManagementForRegularUsers: false,
        allowSysctlSettingForRegularUsers: false,
        allowSecurityOptForRegularUsers: false,
        allowVolumeBrowserForRegularUsers: false,
        enableHostManagementFeatures: false,
      },
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByLabelText('Container')).toBeVisible();
    });
    expect(screen.queryByLabelText('Stack')).not.toBeInTheDocument();
  });

  it('shows stacks for a regular user when stack management is allowed', async () => {
    isEnvAdmin = false;
    envState.data = createMockEnvironment({
      Id: 1,
      Type: EnvironmentType.Docker,
      SecuritySettings: {
        allowBindMountsForRegularUsers: false,
        allowPrivilegedModeForRegularUsers: false,
        allowContainerCapabilitiesForRegularUsers: false,
        allowDeviceMappingForRegularUsers: false,
        allowHostNamespaceForRegularUsers: false,
        allowStackManagementForRegularUsers: true,
        allowSysctlSettingForRegularUsers: false,
        allowSecurityOptForRegularUsers: false,
        allowVolumeBrowserForRegularUsers: false,
        enableHostManagementFeatures: false,
      },
    });

    renderDashboard();

    expect(await screen.findByLabelText('Stack')).toBeVisible();
  });

  it('shows the services tile for a swarm manager', async () => {
    isSwarmManager = true;
    isSwarm = true;

    renderDashboard();

    expect(await screen.findByLabelText('Service')).toBeVisible();
    const service = screen.getByLabelText('Service');
    expect(service).toHaveTextContent('7');
  });

  it('shows the GPU tile when GPU management is enabled and useIsSwarm is true', async () => {
    // Production names the flag isStandalone but calls useIsSwarm — assert observed behaviour.
    isSwarm = true;
    envState.data = createMockEnvironment({
      Id: 1,
      Type: EnvironmentType.Docker,
      EnableGPUManagement: true,
      Gpus: [{ name: 'T4' }, { name: 'T4' }],
    });

    renderDashboard();

    expect(await screen.findByLabelText('GPU')).toBeVisible();
    expect(screen.getByLabelText('GPU')).toHaveTextContent('2');
  });

  it('shows NonAgentSwarmInfo for a non-agent swarm environment', async () => {
    isSwarm = true;
    envState.data = createMockEnvironment({
      Id: 1,
      Type: EnvironmentType.Docker,
    });

    renderDashboard();

    expect(await screen.findByTestId('non-agent-swarm')).toBeVisible();
    expect(screen.getByTestId('env-info-stub')).toBeVisible();
    expect(screen.queryByTestId('cluster-agent')).not.toBeInTheDocument();
  });

  it('shows ClusterAgentInfo for an agent swarm environment', async () => {
    isSwarm = true;
    envState.data = createMockEnvironment({
      Id: 1,
      Type: EnvironmentType.AgentOnDocker,
    });

    renderDashboard();

    expect(await screen.findByTestId('cluster-agent')).toBeVisible();
    expect(screen.queryByTestId('env-info-stub')).not.toBeInTheDocument();
    expect(screen.queryByTestId('non-agent-swarm')).not.toBeInTheDocument();
  });
});
