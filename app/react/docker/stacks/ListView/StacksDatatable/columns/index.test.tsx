import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createMockStack } from '@/react-tools/test-mocks';
import { StackType } from '@/react/common/stacks/types';
import { StackViewModel } from '@/react/docker/stacks/view-models/stack';

import { useColumns } from './index';

function Probe({
  enabled,
  onColumns,
}: {
  enabled: boolean;
  onColumns?: (columns: ReturnType<typeof useColumns>) => void;
}) {
  const columns = useColumns(enabled);
  onColumns?.(columns);
  return (
    <div data-cy="column-ids">
      {columns.map((column) => column.id).join(',')}
    </div>
  );
}

describe('stacks datatable useColumns', () => {
  it('includes local Compose columns and omits image notification when disabled', () => {
    render(<Probe enabled={false} />);
    const ids = screen.getByTestId('column-ids').textContent?.split(',') ?? [];
    expect(ids).toEqual(
      expect.arrayContaining([
        'name',
        'type',
        'control',
        'creationDate',
        'updateDate',
      ])
    );
    expect(ids).not.toContain('imageNotification');
    // REQ-TAI-001: no ownership column
    expect(ids).not.toContain('ownership');
  });

  it('includes the image notification column when enabled', () => {
    render(<Probe enabled />);
    const ids = screen.getByTestId('column-ids').textContent?.split(',') ?? [];
    expect(ids).toContain('imageNotification');
  });

  it('formats Compose type and created/updated cells for local stacks', () => {
    let columns: ReturnType<typeof useColumns> = [];
    render(
      <Probe
        enabled={false}
        onColumns={(cols) => {
          columns = cols;
        }}
      />
    );

    const typeCol = columns.find((c) => c.id === 'type');
    const created = columns.find((c) => c.id === 'creationDate');
    const updated = columns.find((c) => c.id === 'updateDate');

    const compose = new StackViewModel(
      createMockStack({
        Type: StackType.DockerCompose,
        CreationDate: 1700000000,
        CreatedBy: 'admin',
        UpdateDate: 1700001000,
        UpdatedBy: 'bob',
      })
    );

    const typeAccessor = typeCol?.accessorFn as
      | ((row: StackViewModel) => string)
      | undefined;
    expect(typeAccessor?.(compose)).toBe('Compose');

    const createdCell = created?.cell as (ctx: {
      getValue: () => number;
      row: { original: StackViewModel };
    }) => string;
    expect(
      createdCell({
        getValue: () => compose.CreationDate,
        row: { original: compose },
      })
    ).toContain('by admin');
    expect(
      createdCell({
        getValue: () => 0,
        row: { original: compose },
      })
    ).toBe('-');

    const updatedCell = updated?.cell as (ctx: {
      getValue: () => number;
      row: { original: StackViewModel };
    }) => string;
    expect(
      updatedCell({
        getValue: () => compose.UpdateDate,
        row: { original: compose },
      })
    ).toContain('by bob');
    expect(
      updatedCell({
        getValue: () => 0,
        row: { original: compose },
      })
    ).toBe('-');
  });
});
