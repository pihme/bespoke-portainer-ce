import { render, screen } from '@testing-library/react';
import { CellContext } from '@tanstack/react-table';
import { vi } from 'vitest';

import {
  ContainerListViewModel,
  ContainerStatus,
} from '@/react/docker/containers/types';

import { gpus as gpusColumn } from './gpus';

const gpusState: { data: string | undefined } = { data: undefined };

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 7,
}));

vi.mock('@/react/docker/containers/queries/gpus', () => ({
  useContainerGpus: () => gpusState,
}));

function renderGpusCell() {
  const Cell = gpusColumn.cell as React.FC<
    CellContext<ContainerListViewModel, unknown>
  >;
  const ctx = {
    row: {
      original: {
        Id: 'gpu-cid',
        Names: ['gpu'],
        Status: ContainerStatus.Running,
      } as ContainerListViewModel,
    },
  } as unknown as CellContext<ContainerListViewModel, unknown>;

  return render(<Cell {...ctx} />);
}

describe('REQ-CTR-01 containers datatable gpus column', () => {
  beforeEach(() => {
    gpusState.data = undefined;
  });

  it('exports a gpus display column', () => {
    expect(gpusColumn.id).toBe('gpus');
    expect(gpusColumn.header).toBe('GPUs');
  });

  it('renders nothing while GPU data is loading', () => {
    const { container } = renderGpusCell();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders GPU assignment text when data is available', () => {
    gpusState.data = 'device=0';
    renderGpusCell();
    expect(screen.getByText('device=0')).toBeVisible();
  });
});
