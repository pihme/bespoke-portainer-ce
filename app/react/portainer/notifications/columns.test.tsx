import { render, screen } from '@testing-library/react';

import { columns } from './columns';
import { ToastNotification } from './types';

const row: ToastNotification = {
  id: '1',
  title: 'Saved',
  details: 'ok',
  type: 'success',
  timeStamp: new Date('2024-01-02T03:04:00Z'),
};

describe('notification columns (backwards compatibility)', () => {
  it('exposes title details type and time columns', () => {
    expect(columns.map((c) => c.id || c.accessorKey || c.header)).toEqual(
      expect.arrayContaining(['title', 'details', 'type', 'time'])
    );
  });

  it('renders title and details cells', () => {
    const titleCol = columns.find((c) => c.id === 'title' || c.accessorKey === 'title');
    const detailsCol = columns.find(
      (c) => c.id === 'details' || c.accessorKey === 'details'
    );
    if (titleCol?.cell && typeof titleCol.cell === 'function') {
      render(<>{titleCol.cell({ row: { original: row }, getValue: () => row.title } as never)}</>);
      expect(screen.getByText('Saved')).toBeVisible();
    }
    if (detailsCol?.cell && typeof detailsCol.cell === 'function') {
      render(
        <>{detailsCol.cell({ row: { original: row }, getValue: () => row.details } as never)}</>
      );
      expect(screen.getByText('ok')).toBeVisible();
    }
  });
});
