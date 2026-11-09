import { render, screen } from '@testing-library/react';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';

import { buildNameColumn, buildNameColumnFromObject } from './buildNameColumn';

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    to,
    params,
    'data-cy': dataCy,
    title,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    'data-cy'?: string;
    title?: string;
  }) => (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a data-cy={dataCy} data-to={to} data-params={JSON.stringify(params)} title={title}>
      {children}
    </a>
  ),
}));

type Item = { id: string; name: string };

function NameTable({
  column,
  dataset,
}: {
  column: ReturnType<typeof buildNameColumnFromObject<Item>>;
  dataset: Item[];
}) {
  const table = useReactTable({
    data: dataset,
    columns: [column],
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table>
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

describe('buildNameColumn (backwards compatibility)', () => {
  it('buildNameColumn links the name with the default id param', () => {
    render(
      <NameTable
        column={buildNameColumn<Item>('name', 'docker.volumes.volume', 'volume')}
        dataset={[{ id: 'v1', name: 'data' }]}
      />
    );

    const link = screen.getByTestId('volume_data');
    expect(link).toHaveTextContent('data');
    expect(link).toHaveAttribute('data-to', 'docker.volumes.volume');
    expect(link.getAttribute('data-params')).toContain('"id":"v1"');
  });

  it('buildNameColumnFromObject merges custom link params and id getter', () => {
    render(
      <NameTable
        column={buildNameColumnFromObject<Item>({
          nameKey: 'name',
          path: 'docker.volumes.volume',
          dataCy: 'vol',
          idParam: 'volumeId',
          idGetter: (row) => `vol-${row.id}`,
          linkParamsBuilder: () => ({ endpointId: 3 }),
        })}
        dataset={[{ id: '9', name: 'cache' }]}
      />
    );

    const link = screen.getByTestId('vol_cache');
    expect(link.getAttribute('data-params')).toContain('"endpointId":3');
    expect(link.getAttribute('data-params')).toContain('"volumeId":"vol-9"');
  });

  it('returns null when the rendered name is not a string', () => {
    type Weird = { id: string; name: number };
    const column = buildNameColumnFromObject<Weird>({
      nameKey: 'name',
      path: 'x',
      dataCy: 'x',
    });

    function WeirdTable() {
      const table = useReactTable({
        data: [{ id: '1', name: 123 as unknown as number }],
        columns: [column],
        getCoreRowModel: getCoreRowModel(),
      });
      return (
        <div data-cy="host">
          {table.getRowModel().rows.map((row) =>
            row.getVisibleCells().map((cell) => (
              <div key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            ))
          )}
        </div>
      );
    }

    const { container } = render(<WeirdTable />);
    expect(container.querySelector('a')).toBeNull();
  });
});
