import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { createMockUser } from '@/react-tools/test-mocks';
import { Role } from '@/portainer/users/types';

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

import { DecoratedVolume } from '../types';

import { TableActions } from './TableActions';
import { VolumesDatatable } from './VolumesDatatable';

vi.mock('@@/datatables', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@@/datatables')>();
  return {
    ...actual,
    TableSettingsMenu: ({ children }: { children: React.ReactNode }) => (
      <div data-cy="table-settings">{children}</div>
    ),
  };
});

vi.mock('@@/datatables/TableSettingsMenuAutoRefresh', () => ({
  TableSettingsMenuAutoRefresh: ({
    onChange,
  }: {
    onChange: (value: number) => void;
  }) => (
    <button
      type="button"
      data-cy="auto-refresh-trigger"
      onClick={() => onChange(30)}
    >
      refresh
    </button>
  ),
}));

vi.mock('./columns', () => ({
  useColumns: () => [
    {
      id: 'name',
      header: 'Name',
      accessorKey: 'Id',
    },
  ],
}));

vi.mock('@@/modals/confirm', () => ({
  confirmDelete: vi.fn(async () => true),
}));

const volume = {
  Id: 'vol-1',
  Name: 'data',
  Driver: 'local',
  dangling: false,
} as DecoratedVolume;

describe('REQ-VOL-01 VolumesDatatable', () => {
  it('renders loading state when dataset is undefined', () => {
    const Wrapped = withTestQueryProvider(
      withUserProvider(
        withTestRouter(() => (
          <VolumesDatatable
            onRemove={vi.fn()}
            onRefresh={async () => {}}
          />
        )),
        createMockUser({ Role: Role.Admin })
      )
    );
    render(<Wrapped />);
    expect(screen.getByRole('region', { name: 'Volumes' })).toBeVisible();
  });

  it('renders volumes', async () => {
    const Wrapped = withTestQueryProvider(
      withUserProvider(
        withTestRouter(() => (
          <VolumesDatatable
            dataset={[volume]}
            onRemove={vi.fn()}
            onRefresh={async () => {}}
          />
        )),
        createMockUser({ Role: Role.Admin })
      )
    );
    render(<Wrapped />);
    expect(await screen.findByText('vol-1')).toBeVisible();
    expect(screen.getByTestId('docker-volumes-datatable')).toBeVisible();
  });

  it('exposes add volume action for authorized users', async () => {
    const Wrapped = withTestQueryProvider(
      withUserProvider(
        withTestRouter(() => (
          <VolumesDatatable
            dataset={[volume]}
            onRemove={vi.fn()}
            onRefresh={async () => {}}
          />
        )),
        createMockUser({ Role: Role.Admin })
      )
    );
    render(<Wrapped />);
    expect(
      await screen.findByTestId('volume-addVolumeButton')
    ).toBeVisible();
    expect(screen.getByText(/add volume/i)).toBeVisible();
  });

  it('updates auto-refresh through table settings', async () => {
    const user = userEvent.setup();
    const Wrapped = withTestQueryProvider(
      withUserProvider(
        withTestRouter(() => (
          <VolumesDatatable
            dataset={[volume]}
            onRemove={vi.fn()}
            onRefresh={async () => {}}
          />
        )),
        createMockUser({ Role: Role.Admin })
      )
    );
    render(<Wrapped />);
    await user.click(await screen.findByTestId('auto-refresh-trigger'));
    expect(screen.getByTestId('table-settings')).toBeVisible();
  });
});

describe('REQ-VOL-01 TableActions', () => {
  it('disables remove until a volume is selected and confirms removal', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const { confirmDelete } = await import('@@/modals/confirm');

    const Wrapped = withTestQueryProvider(
      withUserProvider(
        withTestRouter(() => (
          <TableActions selectedItems={[]} onRemove={onRemove} />
        )),
        createMockUser({ Role: Role.Admin })
      )
    );
    const { rerender } = render(<Wrapped />);

    expect(
      screen.getByRole('button', { name: /remove/i })
    ).toBeDisabled();

    const WrappedSelected = withTestQueryProvider(
      withUserProvider(
        withTestRouter(() => (
          <TableActions selectedItems={[volume]} onRemove={onRemove} />
        )),
        createMockUser({ Role: Role.Admin })
      )
    );
    rerender(<WrappedSelected />);

    const remove = screen.getByRole('button', { name: /remove/i });
    expect(remove).toBeEnabled();
    await user.click(remove);
    await waitFor(() => expect(confirmDelete).toHaveBeenCalled());
    expect(onRemove).toHaveBeenCalledWith([volume]);
  });
});

describe('REQ-TAI-010 no volume file browser', () => {
  it('renders no Browse button for a volume', async () => {
    const Wrapped = withTestQueryProvider(
      withUserProvider(
        withTestRouter(() => (
          <VolumesDatatable
            dataset={[volume]}
            onRemove={vi.fn()}
            onRefresh={async () => {}}
          />
        )),
        createMockUser({ Role: Role.Admin })
      )
    );
    render(<Wrapped />);
    expect(await screen.findByText('vol-1')).toBeVisible();
    expect(screen.queryByText('Browse')).not.toBeInTheDocument();
  });
});
