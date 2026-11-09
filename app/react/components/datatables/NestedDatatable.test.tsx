import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Box } from 'lucide-react';

import { NestedDatatable } from './NestedDatatable';

type Item = { id: string; name: string };

const columns = [{ accessorKey: 'name', header: 'Name' }];
const dataset: Item[] = [
  { id: '1', name: 'one' },
  { id: '2', name: 'two' },
];

describe('NestedDatatable (backwards compatibility)', () => {
  it('renders titled rows with pagination enabled by default', () => {
    render(
      <NestedDatatable
        dataset={dataset}
        columns={columns}
        title="Nested"
        titleIcon={Box}
        data-cy="nested"
        aria-label="nested-list"
        initialSortBy={{ id: 'name', desc: false }}
      />
    );

    expect(screen.getByText('Nested')).toBeInTheDocument();
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
  });

  it('shows empty and loading content and can disable pagination', () => {
    const { rerender } = render(
      <NestedDatatable
        dataset={[]}
        columns={columns}
        emptyContentLabel="Nothing here"
        data-cy="nested"
        enablePagination={false}
      />
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();

    rerender(
      <NestedDatatable
        dataset={dataset}
        columns={columns}
        isLoading
        data-cy="nested"
        enablePagination={false}
        search="one"
      />
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
