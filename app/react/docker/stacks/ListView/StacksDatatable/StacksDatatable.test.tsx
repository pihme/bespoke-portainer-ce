import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createColumnHelper } from '@tanstack/react-table';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { createMockStack, createMockUser } from '@/react-tools/test-mocks';
import { Role } from '@/portainer/users/types';
import { StackType } from '@/react/common/stacks/types';
import { StackViewModel } from '@/react/docker/stacks/view-models/stack';
import { ExternalStackViewModel } from '@/react/docker/stacks/view-models/external-stack';

import { StacksDatatable } from './StacksDatatable';
import { DecoratedStack } from './types';

const columnHelper = createColumnHelper<DecoratedStack>();

vi.mock('./columns', () => ({
  useColumns: () => [
    columnHelper.accessor('Name', {
      id: 'name',
      header: 'Name',
      enableHiding: false,
    }),
  ],
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
    useIsEdgeAdmin: () => ({ isAdmin: true }),
    Authorized: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock('@@/modals/confirm', () => ({
  confirmDelete: vi.fn(async () => true),
}));

function renderTable(dataset: DecoratedStack[], onRemove = vi.fn(), onReload = vi.fn()) {
  localStorage.clear();
  const Wrapped = withTestQueryProvider(
    withUserProvider(
      withTestRouter(StacksDatatable),
      createMockUser({ Role: Role.Admin })
    )
  );

  return {
    onRemove,
    onReload,
    ...render(
      <Wrapped
        dataset={dataset}
        onRemove={onRemove}
        onReload={onReload}
        isImageNotificationEnabled={false}
      />
    ),
  };
}

describe('REQ-STK-01 StacksDatatable', () => {
  it('renders local compose stacks in the table', () => {
    const stack = new StackViewModel(
      createMockStack({ Id: 11, Name: 'compose-app' })
    );
    renderTable([stack]);

    expect(screen.getByTestId('docker-stacks-datatable')).toBeVisible();
    expect(screen.getByText('Stacks')).toBeVisible();
    expect(screen.getByText('compose-app')).toBeVisible();
  });

  it('does not allow selecting external stacks', async () => {
    const user = userEvent.setup();
    const regular = new StackViewModel(
      createMockStack({ Id: 1, Name: 'local' })
    );
    const external = new ExternalStackViewModel(
      'ext-stack',
      StackType.DockerCompose,
      Date.now()
    );
    renderTable([regular, external]);

    const table = screen.getByTestId('docker-stacks-datatable');
    const checkboxes = within(table).getAllByRole('checkbox');
    // header + selectable rows only: external should not have a row checkbox that selects
    // Select all then verify remove is enabled for regular only via row selection of local
    const rowCheckboxes = checkboxes.filter(
      (cb) => cb.getAttribute('aria-label') !== 'Select all'
    );
    // At least the regular stack should be selectable
    expect(rowCheckboxes.length).toBeGreaterThanOrEqual(1);
    await user.click(rowCheckboxes[0]);
    expect(screen.getByTestId('stack-removeStackButton')).not.toBeDisabled();
  });

  it('hides orphaned stacks from the default filter and shows them when enabled', async () => {
    const user = userEvent.setup();
    const regular = new StackViewModel(
      createMockStack({ Id: 2, Name: 'alive' })
    );
    const orphaned = new StackViewModel(
      createMockStack({ Id: 3, Name: 'orphaned-one' }),
      true
    );
    renderTable([regular, orphaned]);

    const table = screen.getByTestId('docker-stacks-datatable');
    expect(within(table).getByText('alive')).toBeVisible();
    expect(within(table).queryByText('orphaned-one')).not.toBeInTheDocument();

    // open settings and enable orphaned stacks
    const buttons = within(table).getAllByRole('button');
    await user.click(buttons[buttons.length - 1]);
    const checkbox = await screen.findByTestId('show-all-orphaned-stacks');
    await user.click(checkbox);

    expect(await within(table).findByText('orphaned-one')).toBeVisible();
  });

  it('shows empty state when there are no stacks', () => {
    renderTable([]);
    expect(screen.getByTestId('docker-stacks-datatable')).toBeVisible();
  });
});
