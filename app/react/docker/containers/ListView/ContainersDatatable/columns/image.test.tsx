import { render, screen } from '@testing-library/react';
import { CellContext } from '@tanstack/react-table';
import { vi } from 'vitest';
import type { FC } from 'react';

import {
  ContainerListViewModel,
  ContainerStatus,
} from '@/react/docker/containers/types';

import { image as imageColumn } from './image';

vi.mock('@uirouter/react', async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  useSref: () => ({ href: '#image', onClick: vi.fn() }),
}));

function renderImageCell(imageName: string) {
  const Cell = imageColumn.cell as FC<
    CellContext<ContainerListViewModel, string>
  >;
  const ctx = {
    getValue: () => imageName,
    row: {
      original: {
        Id: 'c1',
        Names: ['c'],
        Image: imageName,
        Status: ContainerStatus.Running,
      } as ContainerListViewModel,
    },
  } as unknown as CellContext<ContainerListViewModel, string>;

  return render(<Cell {...ctx} />);
}

describe('REQ-CTR-01 containers datatable image column', () => {
  it('exports an image accessor column', () => {
    expect(imageColumn.id).toBe('image');
    expect(imageColumn.header).toBe('Image');
  });

  it('renders empty string for missing image names', () => {
    const { container } = renderImageCell('');
    expect(container.querySelector('a')).toHaveTextContent('');
  });

  it('shortens sha256 image ids', () => {
    renderImageCell('sha256:abcdef1234567890ffff');
    expect(screen.getByText('abcdef123456')).toBeVisible();
  });

  it('strips digest suffix from tagged images', () => {
    renderImageCell('nginx:latest@sha256:deadbeef');
    expect(screen.getByText('nginx:latest')).toBeVisible();
  });

  it('keeps ordinary image references unchanged', () => {
    renderImageCell('ghcr.io/org/app:1.2.3');
    expect(screen.getByText('ghcr.io/org/app:1.2.3')).toBeVisible();
  });
});
