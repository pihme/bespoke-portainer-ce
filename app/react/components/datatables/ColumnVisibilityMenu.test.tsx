import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  ColumnVisibilityMenu,
  getColumnVisibilityState,
} from './ColumnVisibilityMenu';

type Item = { id: string; name: string; driver: string };

const data: Item[] = [{ id: '1', name: 'data', driver: 'local' }];

function MenuHarness({
  onChange = vi.fn(),
}: {
  onChange?: (value: string[]) => void;
}) {
  const [hidden, setHidden] = useState<string[]>([]);
  const table = useReactTable({
    data,
    columns: [
      { accessorKey: 'name', header: 'Name', enableHiding: true },
      { accessorKey: 'driver', header: 'Driver', enableHiding: true },
      {
        id: 'select',
        header: 'Select',
        enableHiding: false,
        cell: () => null,
      },
    ],
    state: getColumnVisibilityState(hidden),
    onColumnVisibilityChange: () => undefined,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <ColumnVisibilityMenu
      table={table}
      value={hidden}
      onChange={(next) => {
        setHidden(next);
        onChange(next);
      }}
    />
  );
}

describe('ColumnVisibilityMenu (backwards compatibility)', () => {
  it('getColumnVisibilityState maps hidden column ids to false', () => {
    expect(getColumnVisibilityState(['driver', 'name'])).toEqual({
      columnVisibility: { driver: false, name: false },
    });
  });

  it('returns null when no columns can be hidden', () => {
    function Locked() {
      const table = useReactTable({
        data,
        columns: [
          { accessorKey: 'name', header: 'Name', enableHiding: false },
        ],
        getCoreRowModel: getCoreRowModel(),
      });
      return (
        <ColumnVisibilityMenu table={table} value={[]} onChange={vi.fn()} />
      );
    }

    const { container } = render(<Locked />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists hideable columns and hides one when unchecked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MenuHarness onChange={onChange} />);

    await user.click(screen.getByLabelText('Columns'));
    expect(screen.getByText('Show / Hide Columns')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeChecked();
    expect(screen.getByLabelText('Driver')).toBeChecked();

    await user.click(screen.getByLabelText('Driver'));
    expect(onChange).toHaveBeenCalledWith(['driver']);
  });

  it('shows a previously hidden column when checked again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    function PreHidden() {
      const [hidden, setHidden] = useState<string[]>(['driver']);
      const table = useReactTable({
        data,
        columns: [
          { accessorKey: 'name', header: 'Name', enableHiding: true },
          { accessorKey: 'driver', header: 'Driver', enableHiding: true },
        ],
        state: getColumnVisibilityState(hidden),
        getCoreRowModel: getCoreRowModel(),
      });
      return (
        <ColumnVisibilityMenu
          table={table}
          value={hidden}
          onChange={(next) => {
            setHidden(next);
            onChange(next);
          }}
        />
      );
    }

    render(<PreHidden />);
    await user.click(screen.getByLabelText('Columns'));
    await user.click(screen.getByLabelText('Driver'));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
