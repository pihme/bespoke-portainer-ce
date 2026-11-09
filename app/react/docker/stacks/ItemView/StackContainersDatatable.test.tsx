import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import {
  createMockEnvironment,
  createMockUser,
} from '@/react-tools/test-mocks';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { ContainerListViewModel } from '@/react/docker/containers/types';
import { Environment } from '@/react/portainer/environments/types';

import { StackContainersDatatable } from './StackContainersDatatable';

const envState: { data: Environment | undefined } = {
  data: createMockEnvironment({ Id: 3, Name: 'local' }),
};

const containersState: {
  data: ContainerListViewModel[] | undefined;
} = {
  data: [
    {
      Id: 'c1',
      Names: ['/web'],
      Image: 'nginx',
      ImageID: 'img1',
      Command: '',
      Created: 0,
      Ports: [],
      Labels: {},
      State: 'running',
      Status: 'Up',
      NetworkSettings: { Networks: {} },
      Mounts: [],
      IsPortainer: false,
    } as ContainerListViewModel,
  ],
};

vi.mock('@/react/hooks/useCurrentEnvironment', () => ({
  useCurrentEnvironment: () => envState,
}));

vi.mock('./useComposeStackContainers', () => ({
  useComposeStackContainers: vi.fn(() => containersState),
}));

vi.mock('@/react/docker/containers/utils', () => ({
  useShowGPUsColumn: () => false,
}));

vi.mock(
  '@/react/docker/containers/ListView/ContainersDatatable/columns',
  () => ({
    useColumns: () => [],
  })
);

vi.mock(
  '@/react/docker/containers/ListView/ContainersDatatable/ContainersDatatableActions',
  () => ({
    ContainersDatatableActions: () => (
      <div data-cy="containers-actions">actions</div>
    ),
  })
);

vi.mock(
  '@/react/docker/containers/ListView/ContainersDatatable/ContainersDatatableSettings',
  () => ({
    ContainersDatatableSettings: () => (
      <div data-cy="containers-settings">settings</div>
    ),
  })
);

vi.mock('@@/datatables', () => {
  function Datatable({
    title,
    dataset,
    'data-cy': dataCy,
    isLoading,
  }: {
    title: string;
    dataset: unknown[];
    'data-cy'?: string;
    isLoading?: boolean;
  }) {
    return (
      <div data-cy={dataCy}>
        <h2>{title}</h2>
        <span data-cy="dataset-size">{dataset.length}</span>
        <span data-cy="loading">{String(!!isLoading)}</span>
      </div>
    );
  }
  function Table() {
    return null;
  }
  Table.SettingsMenu = function SettingsMenu({
    children,
  }: {
    children?: React.ReactNode;
  }) {
    return <div>{children}</div>;
  };
  return { Datatable, Table };
});

vi.mock('@@/datatables/ColumnVisibilityMenu', () => ({
  ColumnVisibilityMenu: () => null,
  getColumnVisibilityState: () => ({}),
}));

vi.mock('@@/datatables/QuickActionsSettings', () => ({
  buildAction: (id: string, label: string) => ({ id, label }),
  QuickActionsSettings: () => null,
}));

vi.mock('@@/datatables/useTableSettings', () => ({
  TableSettingsProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('@@/datatables/useTableState', () => ({
  useTableState: () => ({
    autoRefreshRateMS: 0,
    hiddenColumns: [],
    setHiddenColumns: vi.fn(),
  }),
}));

vi.mock('../../containers/ListView/ContainersDatatable/RowContext', () => ({
  RowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock(
  '@/react/docker/containers/ListView/ContainersDatatable/datatable-store',
  () => ({
    createStore: () => ({}),
  })
);

describe('REQ-STK-04 StackContainersDatatable', () => {
  beforeEach(() => {
    envState.data = createMockEnvironment({ Id: 3, Name: 'local' });
    containersState.data = [
      {
        Id: 'c1',
        Names: ['/web'],
        Image: 'nginx',
        ImageID: 'img1',
        Command: '',
        Created: 0,
        Ports: [],
        Labels: {},
        State: 'running',
        Status: 'Up',
        NetworkSettings: { Networks: {} },
        Mounts: [],
        IsPortainer: false,
      } as ContainerListViewModel,
    ];
  });

  it('renders the compose stack containers table for the current environment', () => {
    const Wrapped = withTestQueryProvider(
      withTestRouter(
        withUserProvider(StackContainersDatatable, createMockUser({ Role: 1 }))
      )
    );

    render(<Wrapped stackName="my-compose" />);

    expect(screen.getByTestId('stack-containers-datatable')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Containers' })).toBeVisible();
    expect(screen.getByTestId('dataset-size')).toHaveTextContent('1');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('returns null when the environment is not loaded yet', () => {
    envState.data = undefined;

    const Wrapped = withTestQueryProvider(
      withTestRouter(
        withUserProvider(StackContainersDatatable, createMockUser({ Role: 1 }))
      )
    );

    render(<Wrapped stackName="my-compose" />);
    expect(
      screen.queryByTestId('stack-containers-datatable')
    ).not.toBeInTheDocument();
  });
});
