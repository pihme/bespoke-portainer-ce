import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { buildExpandColumn } from './expand-column';

type Item = { id: string; name: string; sub?: Item[] };

const data: Item[] = [
  { id: '1', name: 'parent', sub: [{ id: '1a', name: 'child' }] },
  { id: '2', name: 'leaf' },
];

function ExpandTable() {
  const [expanded, setExpanded] = useState({});
  const table = useReactTable({
    data,
    columns: [
      buildExpandColumn<Item>(),
      { accessorKey: 'name', header: 'Name' },
    ],
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: (row) => !!row.original.sub?.length,
    getSubRows: (row) => row.sub,
  });

  return (
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
  );
}

describe('buildExpandColumn (backwards compatibility)', () => {
  it('renders expand controls for expandable rows and expands on click', async () => {
    const user = userEvent.setup();
    render(<ExpandTable />);

    expect(screen.getByTestId('expand-all-rows-button')).toBeInTheDocument();
    expect(screen.getByTestId('expand-row-button_0')).toBeInTheDocument();
    expect(screen.queryByTestId('expand-row-button_1')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('expand-row-button_0'));
    expect(screen.getByText('child')).toBeInTheDocument();

    await user.click(screen.getByTestId('expand-all-rows-button'));
  });
});
