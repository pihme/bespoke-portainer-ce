import { render, screen } from '@testing-library/react';
import { CellContext } from '@tanstack/react-table';

import {
  ContainerListViewModel,
  ContainerStatus,
} from '@/react/docker/containers/types';

import { state as stateColumn } from './state';

function renderStateCell(
  status: ContainerStatus,
  statusText = 'Up 1 minute'
) {
  const Cell = stateColumn.cell as React.FC<
    CellContext<ContainerListViewModel, ContainerStatus>
  >;
  const ctx = {
    getValue: () => status,
    row: {
      original: {
        Id: 'c1',
        Names: ['c'],
        Status: status,
        StatusText: statusText,
        State: status,
      } as ContainerListViewModel,
    },
  } as unknown as CellContext<ContainerListViewModel, ContainerStatus>;

  return render(<Cell {...ctx} />);
}

describe('REQ-CTR-01 containers datatable state column', () => {
  it('exports a filterable state column', () => {
    expect(stateColumn.id).toBe('state');
    expect(stateColumn.header).toBe('State');
    expect(stateColumn.enableColumnFilter).toBe(true);
  });

  it.each([
    [ContainerStatus.Running, 'success', 'running'],
    [ContainerStatus.Healthy, 'success', 'healthy'],
    [ContainerStatus.Created, 'info', 'created'],
    [ContainerStatus.Paused, 'warning', 'paused'],
    [ContainerStatus.Starting, 'warning', 'starting'],
    [ContainerStatus.Unhealthy, 'warning', 'unhealthy'],
    [ContainerStatus.Restarting, 'warning', 'restarting'],
    [ContainerStatus.Removing, 'warning', 'removing'],
    [ContainerStatus.Stopped, 'danger', 'stopped'],
    [ContainerStatus.Dead, 'danger', 'dead'],
  ] as const)(
    'renders %s with label-%s',
    (status, className, text) => {
      renderStateCell(status);
      const label = screen.getByText(text);
      expect(label).toHaveClass('label', `label-${className}`);
    }
  );

  it('appends the exit code for exited containers', () => {
    renderStateCell(ContainerStatus.Exited, 'Exited (137) 2 minutes ago');
    expect(screen.getByText('exited - code 137')).toBeVisible();
    expect(screen.getByText('exited - code 137')).toHaveClass('label-danger');
  });

  it('uses an empty exit code when StatusText has no code', () => {
    renderStateCell(ContainerStatus.Exited, 'Exited');
    expect(screen.getByText('exited - code')).toBeVisible();
  });

  it('marks health-check statuses as interactive', () => {
    renderStateCell(ContainerStatus.Healthy);
    expect(screen.getByText('healthy')).toHaveClass('interactive');
    expect(screen.getByText('healthy')).toHaveAttribute(
      'title',
      'This container has a health check'
    );
  });
});
