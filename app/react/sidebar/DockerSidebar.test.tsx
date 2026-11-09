import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { createMockEnvironment, createMockUser } from '@/react-tools/test-mocks';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { EnvironmentType } from '@/react/portainer/environments/types';

import { TestSidebarProvider } from './useSidebarState';
import { DockerSidebar } from './DockerSidebar';

let isEnvironmentAdmin = true;
let isSwarmManager = false;
let apiVersion = 1.41;

vi.mock('@/react/hooks/useUser', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/react/hooks/useUser')>();
  return {
    ...actual,
    useIsEnvironmentAdmin: () => ({ authorized: isEnvironmentAdmin }),
    Authorized: ({
      children,
    }: {
      children: React.ReactNode;
    }) => <>{children}</>,
  };
});

vi.mock('@/react/docker/proxy/queries/useInfo', () => ({
  useInfo: () => ({ data: isSwarmManager }),
}));

vi.mock('@/react/docker/proxy/queries/useVersion', () => ({
  useApiVersion: () => apiVersion,
}));

function renderDockerSidebar(
  environment = createMockEnvironment({
    Id: 1,
    Name: 'local',
    Type: EnvironmentType.Docker,
  })
) {
  const Wrapped = withUserProvider(
    withTestRouter(DockerSidebar),
    createMockUser({ Role: 1 })
  );

  return render(
    <TestSidebarProvider>
      <Wrapped environmentId={environment.Id} environment={environment} />
    </TestSidebarProvider>
  );
}

describe('DockerSidebar local Docker navigation', () => {
  beforeEach(() => {
    isEnvironmentAdmin = true;
    isSwarmManager = false;
    apiVersion = 1.41;
  });

  it('shows dashboard templates stacks containers images networks volumes and host for standalone', () => {
    renderDockerSidebar();

    expect(screen.getByTestId('dockerSidebar-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('portainerSidebar-templates')).toBeInTheDocument();
    expect(screen.getByTestId('portainerSidebar-appTemplates')).toBeInTheDocument();
    expect(screen.getByTestId('dockerSidebar-customTemplates')).toBeInTheDocument();
    expect(screen.getByTestId('dockerSidebar-stacks')).toBeInTheDocument();
    expect(screen.getByTestId('dockerSidebar-containers')).toBeInTheDocument();
    expect(screen.getByTestId('dockerSidebar-images')).toBeInTheDocument();
    expect(screen.getByTestId('dockerSidebar-networks')).toBeInTheDocument();
    expect(screen.getByTestId('dockerSidebar-volumes')).toBeInTheDocument();
    expect(screen.getByTestId('dockerSidebar-events')).toBeInTheDocument();
    expect(screen.getByTestId('portainerSidebar-host')).toBeInTheDocument();
    expect(screen.getByTestId('portainerSidebar-docker-setup')).toBeInTheDocument();
    expect(
      screen.getByTestId('portainerSidebar-docker-registries')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('dockerSidebar-services')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dockerSidebar-configs')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dockerSidebar-secrets')).not.toBeInTheDocument();
    expect(screen.queryByTestId('portainerSidebar-swarm')).not.toBeInTheDocument();
  });

  it('hides stacks for regular users when stack management is disallowed', () => {
    isEnvironmentAdmin = false;
    const environment = createMockEnvironment({
      Id: 1,
      Name: 'local',
      Type: EnvironmentType.Docker,
      SecuritySettings: {
        ...createMockEnvironment().SecuritySettings,
        allowStackManagementForRegularUsers: false,
      },
    });

    renderDockerSidebar(environment);

    expect(screen.queryByTestId('dockerSidebar-stacks')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dockerSidebar-events')).not.toBeInTheDocument();
  });

  it('shows stacks for regular users when stack management is allowed', () => {
    isEnvironmentAdmin = false;
    const environment = createMockEnvironment({
      Id: 1,
      Name: 'local',
      Type: EnvironmentType.Docker,
      SecuritySettings: {
        ...createMockEnvironment().SecuritySettings,
        allowStackManagementForRegularUsers: true,
      },
    });

    renderDockerSidebar(environment);

    expect(screen.getByTestId('dockerSidebar-stacks')).toBeInTheDocument();
  });

  it('shows swarm services configs secrets and swarm setup when node is swarm manager', () => {
    isSwarmManager = true;
    apiVersion = 1.41;

    renderDockerSidebar();

    expect(screen.getByTestId('dockerSidebar-services')).toBeInTheDocument();
    expect(screen.getByTestId('dockerSidebar-configs')).toBeInTheDocument();
    expect(screen.getByTestId('dockerSidebar-secrets')).toBeInTheDocument();
    expect(screen.getByTestId('portainerSidebar-swarm')).toBeInTheDocument();
    expect(screen.queryByTestId('dockerSidebar-events')).not.toBeInTheDocument();
    expect(screen.queryByTestId('portainerSidebar-host')).not.toBeInTheDocument();
  });

  it('hides configs and secrets when api version is below swarm thresholds', () => {
    isSwarmManager = true;
    apiVersion = 1.2;

    renderDockerSidebar();

    expect(screen.queryByTestId('dockerSidebar-configs')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dockerSidebar-secrets')).not.toBeInTheDocument();
    expect(screen.getByTestId('dockerSidebar-services')).toBeInTheDocument();
  });

  it('shows secrets but not configs at api 1.25 before configs threshold', () => {
    isSwarmManager = true;
    // parseFloat("1.30") === 1.3, so configs gate at >= 1.3; secrets at >= 1.25
    apiVersion = 1.25;

    renderDockerSidebar();

    expect(screen.getByTestId('dockerSidebar-secrets')).toBeInTheDocument();
    expect(screen.queryByTestId('dockerSidebar-configs')).not.toBeInTheDocument();
  });
});
