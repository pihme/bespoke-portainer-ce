import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Box } from 'lucide-react';

import { BasicTable } from './BasicTable';

type Row = { id: string; name: string; size: number };

const columns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'size', header: 'Size' },
];

const dataset: Row[] = [
  { id: '1', name: 'beta', size: 20 },
  { id: '2', name: 'alpha', size: 10 },
  { id: '3', name: 'gamma', size: 30 },
];

describe('BasicTable (backwards compatibility)', () => {
  it('renders the title icon, rows, and empty label', () => {
    const { rerender } = render(
      <BasicTable
        dataset={dataset}
        columns={columns}
        data-cy="basic-table"
        title="Volumes"
        titleIcon={Box}
      />
    );

    expect(screen.getByText('Volumes')).toBeInTheDocument();
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByLabelText('Volumes')).toBeInTheDocument();

    rerender(
      <BasicTable
        dataset={[]}
        columns={columns}
        data-cy="basic-table"
        emptyContentLabel="No volumes."
        aria-label="empty-volumes"
      />
    );
    expect(screen.getByText('No volumes.')).toBeInTheDocument();
    expect(screen.getByLabelText('empty-volumes')).toBeInTheDocument();
  });

  it('applies initialSortBy to the rendered row order', () => {
    render(
      <BasicTable
        dataset={dataset}
        columns={columns}
        data-cy="basic-table"
        initialSortBy={{ id: 'name', desc: false }}
        title="Sorted"
      />
    );

    const cells = screen.getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('alpha');
    expect(cells[2]).toHaveTextContent('beta');
    expect(cells[4]).toHaveTextContent('gamma');
  });

  it('applies descending initialSortBy', () => {
    render(
      <BasicTable
        dataset={dataset}
        columns={columns}
        data-cy="basic-table"
        initialSortBy={{ id: 'size', desc: true }}
      />
    );

    const cells = screen.getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('gamma');
    expect(cells[1]).toHaveTextContent('30');
  });
});
