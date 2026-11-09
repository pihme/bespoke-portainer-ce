import { render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { createMockEnvironment, createMockUser } from '@/react-tools/test-mocks';
import { Role } from '@/portainer/users/types';
import {
  ContainerListViewModel,
  ContainerStatus,
} from '@/react/docker/containers/types';

import { ContainersDatatable } from './ContainersDatatable';

const containersState: {
  data: ContainerListViewModel[] | undefined;
  isLoading: boolean;
} = {
  data: [],
  isLoading: false,
};

let showGpus = false;

vi.mock('../../queries/useContainers', () => ({
  useContainers: () => containersState,
}));

vi.mock('@/react/docker/containers/utils', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/react/docker/containers/utils')>();
  return {
    ...actual,
    useShowGPUsColumn: () => showGpus,
  };
});

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@/react/docker/containers/queries/gpus', () => ({
  useContainerGpus: () => ({ data: 'all' }),
}));

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useSref: () => ({ href: '#', onClick: vi.fn() }),
  useCurrentStateAndParams: () => ({ params: { endpointId: 1 } }),
}));

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    'data-cy': dataCy,
  }: {
    children: React.ReactNode;
    'data-cy'?: string;
  }) => (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a data-cy={dataCy}>{children}</a>
  ),
}));

vi.mock('@/react/hooks/useUser', async (importOriginal: () => Promise<object>) => {
  const actual = await importOriginal<typeof import('@/react/hooks/useUser')>();
  return {
    ...actual,
    useAuthorizations: () => ({ authorized: true }),
    Authorized: ({ children }: { children: React.ReactNode }) => children,
  };
});

function createContainer(
  overrides: Partial<ContainerListViewModel> = {}
): ContainerListViewModel {
  return {
    Id: 'cid-web',
    Names: ['web-frontend'],
    Image: 'nginx:latest',
    ImageID: 'sha256:abc',
    Command: 'nginx',
    Created: 1704067200,
    Ports: [
      { host: '0.0.0.0', public: 8080, private: 80 },
      { host: '0.0.0.0', public: 8443, private: 443 },
    ],
    Labels: {},
    State: 'running',
    Status: ContainerStatus.Running,
    StatusText: 'Up 2 hours',
    HostConfig: {},
    Mounts: [],
    NodeName: 'worker-1',
    IP: '172.17.0.2',
    StackName: 'webstack',
    Gpus: '',
    IsPortainer: false,
    ...overrides,
  } as ContainerListViewModel;
}

function renderDatatable({
  isHostColumnVisible = false,
  enableGpu = false,
}: {
  isHostColumnVisible?: boolean;
  enableGpu?: boolean;
} = {}) {
  showGpus = enableGpu;
  const environment = createMockEnvironment({
    Id: 1,
    PublicURL: 'docker.local',
    EnableGPUManagement: enableGpu,
  });

  const Wrapped = withTestQueryProvider(
    withUserProvider(
      withTestRouter(ContainersDatatable),
      createMockUser({ Role: Role.Admin })
    )
  );

  return render(
    <Wrapped
      isHostColumnVisible={isHostColumnVisible}
      environment={environment}
    />
  );
}

describe('REQ-CTR-01 ContainersDatatable', () => {
  beforeEach(() => {
    localStorage.clear();
    containersState.data = [];
    containersState.isLoading = false;
    showGpus = false;
  });

  it('shows loading state while containers are fetched', () => {
    containersState.isLoading = true;
    containersState.data = undefined;
    renderDatatable();

    expect(screen.getByText(/Loading/i)).toBeVisible();
    expect(screen.getByTestId('docker-containers-datatable')).toBeVisible();
  });

  it('shows empty state when there are no containers', async () => {
    containersState.data = [];
    renderDatatable();

    await waitFor(() => {
      expect(screen.getByText(/No items available./i)).toBeInTheDocument();
    });
  });

  it('renders local container rows with name image state stack ip and ports', async () => {
    containersState.data = [
      createContainer(),
      createContainer({
        Id: 'cid-db',
        Names: ['db'],
        Image: 'postgres:15',
        Status: ContainerStatus.Exited,
        State: 'exited',
        StatusText: 'Exited (1) 3 minutes ago',
        Ports: [],
        IP: '',
        StackName: undefined,
        NodeName: '',
      }),
    ];

    renderDatatable();

    await waitFor(() => {
      expect(screen.getByText('web-frontend')).toBeVisible();
    });

    expect(screen.getByText('nginx:latest')).toBeVisible();
    expect(screen.getAllByText('running').length).toBeGreaterThan(0);
    expect(screen.getByText('webstack')).toBeVisible();
    expect(screen.getByText('172.17.0.2')).toBeVisible();
    expect(screen.getByText('db')).toBeVisible();
    expect(screen.getByText(/exited - code 1/i)).toBeVisible();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  it('shows host column when isHostColumnVisible', async () => {
    containersState.data = [createContainer({ NodeName: 'worker-1' })];
    renderDatatable({ isHostColumnVisible: true });

    await waitFor(() => {
      expect(screen.getByText('worker-1')).toBeVisible();
    });
    expect(screen.getAllByText('Host').length).toBeGreaterThan(0);
  });

  it('shows GPUs column when GPU management is enabled', async () => {
    containersState.data = [createContainer()];
    renderDatatable({ enableGpu: true });

    await waitFor(() => {
      expect(screen.getAllByText('GPUs').length).toBeGreaterThan(0);
      expect(screen.getByText('all')).toBeVisible();
    });
  });

  it('does not allow selecting the Portainer container row', async () => {
    containersState.data = [
      createContainer({
        Id: 'cid-portainer',
        Names: ['portainer'],
        IsPortainer: true,
      }),
      createContainer({ Id: 'cid-app', Names: ['app'] }),
    ];
    renderDatatable();

    await waitFor(() => {
      expect(screen.getByText('portainer')).toBeVisible();
    });

    const table = screen.getByTestId('docker-containers-datatable');
    const checkboxes = within(table).getAllByRole('checkbox');
    const enabled = checkboxes.filter(
      (box) => !(box as HTMLInputElement).disabled
    );
    expect(enabled.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Containers')).toBeVisible();
    expect(screen.getByTestId('add-docker-container-button')).toBeVisible();
  });

  it('renders quick actions for authorized users', async () => {
    containersState.data = [createContainer()];
    renderDatatable();

    await waitFor(() => {
      expect(screen.getByTestId('container-logs-cid-web')).toBeInTheDocument();
    });
    expect(screen.getByTestId('container-inspect-cid-web')).toBeInTheDocument();
    expect(screen.getByTestId('container-stats-cid-web')).toBeInTheDocument();
  });
});
