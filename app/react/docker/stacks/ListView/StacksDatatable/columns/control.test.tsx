import { CellContext } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createMockStack } from '@/react-tools/test-mocks';
import { StackType } from '@/react/common/stacks/types';
import { ExternalStackViewModel } from '@/react/docker/stacks/view-models/external-stack';
import { StackViewModel } from '@/react/docker/stacks/view-models/stack';

import { DecoratedStack } from '../types';

import { control } from './control';

function renderControl(item: DecoratedStack) {
  const cell = control.cell as (
    ctx: CellContext<DecoratedStack, unknown>
  ) => React.ReactNode;
  return render(
    <>{cell({ row: { original: item } } as CellContext<DecoratedStack, unknown>)}</>
  );
}

describe('stacks control column', () => {
  it('exports the control display column', () => {
    expect(control.id).toBe('control');
    expect(control.header).toBe('Control');
  });

  it('shows Total for a regular Compose stack', () => {
    const item = new StackViewModel(createMockStack({ Name: 'web' }));
    renderControl(item);
    expect(screen.getByText('Total')).toBeVisible();
  });

  it('shows Limited for an external stack', () => {
    const item = new ExternalStackViewModel(
      'ext',
      StackType.DockerCompose,
      Date.now()
    );
    renderControl(item);
    expect(screen.getByText('Limited')).toBeVisible();
  });

  it('shows Orphaned for an orphaned stack', () => {
    const item = new StackViewModel(createMockStack({ Name: 'old' }), true);
    renderControl(item);
    expect(screen.getByText('Orphaned')).toBeVisible();
  });
});
