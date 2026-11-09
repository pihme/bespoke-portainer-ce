import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { columns } from './index';
import { columnHelper } from './helper';
import { details } from './details';
import { time } from './time';
import { title } from './title';
import { type } from './type';

function renderCell(
  column: { cell?: unknown },
  value: unknown
) {
  const Cell = column.cell as (ctx: unknown) => React.ReactNode;
  return render(<>{Cell({ getValue: () => value })}</>);
}

describe('notifications columns', () => {
  it('exports type, title, details and time columns', () => {
    expect(columns.map((c) => c.id)).toEqual([
      'type',
      'title',
      'details',
      'time',
    ]);
    expect(columnHelper).toBeTruthy();
    expect(title.id).toBe('title');
  });

  it('capitalizes notification type', () => {
    renderCell(type, 'error');
    expect(screen.getByText('Error')).toBeVisible();
  });

  it('renders details with normal whitespace', () => {
    renderCell(details, 'something failed');
    expect(screen.getByText('something failed')).toBeVisible();
  });

  it('formats timestamps and falls back to dash', () => {
    const { rerender } = renderCell(time, new Date('2024-01-01T12:00:00Z'));
    expect(screen.getByText(/2024/)).toBeVisible();

    rerender(
      <>
        {(time.cell as (ctx: unknown) => React.ReactNode)({
          getValue: () => null,
        })}
      </>
    );
    expect(screen.getByText('-')).toBeVisible();
  });
});
