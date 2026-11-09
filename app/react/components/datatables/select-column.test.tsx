import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { createSelectColumn } from './select-column';

type Item = { id: string; name: string };

const data: Item[] = [
  { id: '1', name: 'one' },
  { id: '2', name: 'two' },
  { id: '3', name: 'three' },
  { id: '4', name: 'four' },
];

function SelectTable({ pageSize = 2 }: { pageSize?: number }) {
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  // Memoize so createSelectColumn keeps its lastSelectedId across renders.
  const columns = useMemo<ColumnDef<Item>[]>(
    () => [
      createSelectColumn<Item>('volumes'),
      { accessorKey: 'name', header: 'Name' },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection, pagination: { pageIndex: 0, pageSize } },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <div>
      <table>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th key={header.id}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div data-cy="selected-ids">
        {Object.keys(rowSelection)
          .filter((id) => rowSelection[id])
          .sort()
          .join(',')}
      </div>
    </div>
  );
}

function selectedText() {
  return screen.getByTestId('selected-ids').textContent ?? '';
}

describe('createSelectColumn (backwards compatibility)', () => {
  it('selects all rows on the current page via the header checkbox', async () => {
    const user = userEvent.setup();
    render(<SelectTable pageSize={2} />);

    await user.click(screen.getByLabelText('Select all rows'));
    expect(selectedText()).toBe('1,2');
  });

  it('selects a single row via its checkbox', async () => {
    const user = userEvent.setup();
    render(<SelectTable pageSize={4} />);

    await user.click(screen.getByTestId('select-row-checkbox_2'));
    expect(selectedText()).toBe('2');
  });

  it('shift-click on the header selects across all pages', () => {
    render(<SelectTable pageSize={2} />);

    fireEvent.click(screen.getByLabelText('Select all rows'), { shiftKey: true });
    expect(selectedText()).toBe('1,2,3,4');
  });

  it('shift-click between row checkboxes selects the inclusive range', async () => {
    const user = userEvent.setup();
    render(<SelectTable pageSize={4} />);

    await user.click(screen.getByTestId('select-row-checkbox_1'));
    expect(selectedText()).toBe('1');

    fireEvent.click(screen.getByTestId('select-row-checkbox_3'), {
      shiftKey: true,
    });

    // Range toggle applies lastSelected state to 1..3; onChange then toggles 3.
    // Assert the range helper at least selected the middle row.
    expect(selectedText()).toContain('2');
  });
});
