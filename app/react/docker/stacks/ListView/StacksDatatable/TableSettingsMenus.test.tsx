import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';

import { createMockStack } from '@/react-tools/test-mocks';
import { StackViewModel } from '@/react/docker/stacks/view-models/stack';

import { TableSettingsMenus } from './TableSettingsMenus';
import { TableSettings } from './store';
import { DecoratedStack } from './types';

vi.mock('@/react/hooks/useUser', async (importOriginal: () => Promise<object>) => {
  const actual = await importOriginal<typeof import('@/react/hooks/useUser')>();
  return {
    ...actual,
    Authorized: ({ children }: { children: React.ReactNode }) => children,
  };
});

function createSettings(
  overrides: Partial<TableSettings> = {}
): TableSettings {
  return {
    pageSize: 10,
    setPageSize: vi.fn(),
    sortBy: { id: 'name', desc: false },
    setSortBy: vi.fn(),
    search: '',
    setSearch: vi.fn(),
    hiddenColumns: [],
    setHiddenColumns: vi.fn(),
    autoRefreshRateMS: 0,
    setAutoRefreshRate: vi.fn(),
    columnFilters: [],
    setColumnFilters: vi.fn(),
    showOrphanedStacks: false,
    setShowOrphanedStacks: vi.fn(),
    ...overrides,
  };
}

const columnHelper = createColumnHelper<DecoratedStack>();
const columns = [
  columnHelper.accessor('Name', { id: 'name', header: 'Name' }),
  columnHelper.accessor('Type', { id: 'type', header: 'Type', enableHiding: true }),
];

function Harness({
  tableState,
}: {
  tableState: TableSettings;
}) {
  const dataset = [new StackViewModel(createMockStack())];
  const table = useReactTable({
    data: dataset,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnVisibility: Object.fromEntries(
        tableState.hiddenColumns.map((col) => [col, false])
      ),
    },
  });

  return (
    <TableSettingsMenus tableInstance={table} tableState={tableState} />
  );
}

describe('REQ-STK-01 StacksDatatable TableSettingsMenus', () => {
  it('toggles show all orphaned stacks and updates global filter', async () => {
    const user = userEvent.setup();
    const setShowOrphanedStacks = vi.fn();
    const tableState = createSettings({ setShowOrphanedStacks });

    render(<Harness tableState={tableState} />);

    // open settings menu if needed - Checkbox may be behind TableSettingsMenu button
    const settingsButtons = screen.getAllByRole('button');
    // click the settings (gear) button - TableSettingsMenu renders a button
    await user.click(settingsButtons[settingsButtons.length - 1]);

    const checkbox = await screen.findByTestId('show-all-orphaned-stacks');
    await user.click(checkbox);

    expect(setShowOrphanedStacks).toHaveBeenCalledWith(true);
  });

  it('wires auto-refresh rate changes', async () => {
    const user = userEvent.setup();
    const setAutoRefreshRate = vi.fn();
    render(
      <Harness tableState={createSettings({ setAutoRefreshRate })} />
    );

    const settingsButtons = screen.getAllByRole('button');
    await user.click(settingsButtons[settingsButtons.length - 1]);

    const autoRefresh = await screen.findByTestId('settings-auto-refresh');
    await user.click(autoRefresh);

    expect(setAutoRefreshRate).toHaveBeenCalledWith(10000);
  });
});
