import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Box } from 'lucide-react';
import { ComponentProps } from 'react';

import { CardExpandableList } from './CardExpandableList';
import {
  createPersistedStore,
  refreshableSettings,
  TableSettingsWithRefreshable,
} from './types';
import { useTableState } from './useTableState';

type Item = { id: string; name: string; driver: string };

const dataset: Item[] = [
  { id: '1', name: 'alpha-vol', driver: 'local' },
  { id: '2', name: 'beta-vol', driver: 'local' },
  { id: '3', name: 'gamma-vol', driver: 'nfs' },
];

const columns = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ getValue }: { getValue: () => unknown }) => (
      <span>{String(getValue())}</span>
    ),
  },
  {
    accessorKey: 'driver',
    header: 'Driver',
    cell: ({ getValue }: { getValue: () => unknown }) => (
      <span>{String(getValue())}</span>
    ),
  },
];

function createStore(storageKey: string) {
  return createPersistedStore<TableSettingsWithRefreshable>(
    storageKey,
    'name',
    (set) => ({
      ...refreshableSettings(set),
    })
  );
}

const storageKey = 'card-list-test';
const settingsStore = createStore(storageKey);

function ListWithStore(
  props: Omit<ComponentProps<typeof CardExpandableList<Item>>, 'settingsManager'>
) {
  const tableState = useTableState(settingsStore, storageKey);
  return (
    <CardExpandableList
      {...props}
      settingsManager={tableState}
      data-cy="card-list"
      renderSubRow={(row) => <div>sub-{row.original.name}</div>}
    />
  );
}

describe('CardExpandableList (backwards compatibility)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('renders title, rows, description and expands a row', async () => {
    const user = userEvent.setup();
    render(
      <ListWithStore
        dataset={dataset}
        columns={columns}
        title="Volumes"
        titleIcon={Box}
        description="Local volumes"
        getRowCanExpand={() => true}
      />
    );

    expect(screen.getByText('Volumes')).toBeInTheDocument();
    expect(screen.getByText('Local volumes')).toBeInTheDocument();
    expect(screen.getByText('alpha-vol')).toBeInTheDocument();

    await user.click(screen.getAllByLabelText('Expand')[0]);
    expect(screen.getByText('sub-alpha-vol')).toBeInTheDocument();
  });

  it('shows loading and empty states', () => {
    const { rerender } = render(
      <ListWithStore
        dataset={dataset}
        columns={columns}
        title="Volumes"
        isLoading
      />
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    rerender(
      <ListWithStore
        dataset={[]}
        columns={columns}
        title="Volumes"
        emptyContentLabel="No volumes."
      />
    );
    expect(screen.getByText('No volumes.')).toBeInTheDocument();
  });

  it('disables selection when disableSelect is set and still renders actions/settings', () => {
    render(
      <ListWithStore
        dataset={dataset}
        columns={columns}
        title="Volumes"
        disableSelect
        renderTableActions={(selected) => (
          <span data-cy="actions">acts-{selected.length}</span>
        )}
        renderTableSettings={() => <span data-cy="settings">settings</span>}
      />
    );

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByTestId('actions')).toHaveTextContent('acts-0');
    expect(screen.getByTestId('settings')).toHaveTextContent('settings');
  });

  it('filters rows through the search bar', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(
      <ListWithStore
        dataset={dataset}
        columns={columns}
        title="Volumes"
        onSearchChange={onSearchChange}
        includeSearch
      />
    );

    await user.type(screen.getByLabelText('Search input'), 'gamma');
    await waitFor(() => {
      expect(screen.getByText('gamma-vol')).toBeInTheDocument();
      expect(screen.queryByText('alpha-vol')).not.toBeInTheDocument();
    });
    expect(onSearchChange).toHaveBeenCalled();
  });

  it('selects a row and reports it in the footer', async () => {
    const user = userEvent.setup();
    render(
      <ListWithStore
        dataset={dataset}
        columns={columns}
        title="Volumes"
        getRowCanExpand={() => false}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);
    expect(screen.getByText(/1 item selected/)).toBeInTheDocument();
  });

  it('expands on card click when expandOnRowClick is enabled', async () => {
    const user = userEvent.setup();
    render(
      <ListWithStore
        dataset={dataset}
        columns={columns}
        title="Volumes"
        expandOnRowClick
        getRowCanExpand={() => true}
      />
    );

    await user.click(screen.getByText('beta-vol'));
    expect(screen.getByText('sub-beta-vol')).toBeInTheDocument();
  });

  it('supports server-side pagination props', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const serverStore = createStore('card-server');
    serverStore.getState().setPageSize(2);

    function ServerList() {
      const tableState = useTableState(serverStore, 'card-server');
      return (
        <CardExpandableList
          dataset={dataset.slice(0, 2)}
          columns={columns}
          settingsManager={tableState}
          data-cy="card-server"
          title="Paged"
          isServerSidePagination
          totalCount={6}
          page={0}
          onPageChange={onPageChange}
          renderSubRow={() => null}
          getRowCanExpand={() => false}
        />
      );
    }

    render(<ServerList />);
    expect(screen.getByText('alpha-vol')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '›' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
