import { render, screen } from '@testing-library/react';
import { CellContext, Row } from '@tanstack/react-table';

import {
  ContainerListViewModel,
  ContainerStatus,
} from '@/react/docker/containers/types';
import { isoDateFromTimestamp } from '@/portainer/filters/filters';

import { created as createdColumn } from './created';

describe('REQ-CTR-01 containers datatable created column', () => {
  it('exports a created accessor column', () => {
    expect(createdColumn.id).toBe('created');
    expect(createdColumn.header).toBe('Created');
  });

  it('formats created timestamps in the accessor and cell', () => {
    const row = {
      Created: 1704067200,
      Id: 'c1',
      Names: ['c'],
      Status: ContainerStatus.Running,
    } as ContainerListViewModel;

    const accessor = createdColumn.accessorFn as (
      row: ContainerListViewModel
    ) => string;
    expect(accessor(row)).toBe(isoDateFromTimestamp(1704067200));

    const Cell = createdColumn.cell as React.FC<
      CellContext<ContainerListViewModel, string>
    >;
    render(
      <Cell
        {...({
          row: { original: row } as Row<ContainerListViewModel>,
        } as CellContext<ContainerListViewModel, string>)}
      />
    );

    expect(
      screen.getByText(isoDateFromTimestamp(1704067200))
    ).toBeVisible();
  });
});
