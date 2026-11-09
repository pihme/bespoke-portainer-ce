import { CellContext } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createMockStack } from '@/react-tools/test-mocks';
import { StackType } from '@/react/common/stacks/types';
import { ExternalStackViewModel } from '@/react/docker/stacks/view-models/external-stack';
import { StackViewModel } from '@/react/docker/stacks/view-models/stack';

import { DecoratedStack } from '../types';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('./StackImageStatus', () => ({
  StackImageStatus: ({
    stackId,
    environmentId,
  }: {
    stackId: number;
    environmentId: number;
  }) => (
    <div data-cy="stack-image-status">
      {environmentId}:{stackId}
    </div>
  ),
}));

vi.mock('@/react/docker/components/datatable/TableColumnHeaderImageUpToDate', () => ({
  ImageUpToDateTooltip: () => <span>tooltip</span>,
}));

import { imageNotificationColumn } from './image-notification';

describe('imageNotificationColumn', () => {
  it('renders the header with tooltip', () => {
    const Header = imageNotificationColumn.header as () => React.ReactNode;
    render(<>{Header()}</>);
    expect(screen.getByText('Images up to date')).toBeVisible();
    expect(screen.getByText('tooltip')).toBeVisible();
  });

  it('renders StackImageStatus for a regular Compose stack', () => {
    const item = new StackViewModel(createMockStack({ Id: 42, Name: 'web' }));
    const cell = imageNotificationColumn.cell as (
      ctx: CellContext<DecoratedStack, unknown>
    ) => React.ReactNode;
    render(
      <>{cell({ row: { original: item } } as CellContext<DecoratedStack, unknown>)}</>
    );
    expect(screen.getByTestId('stack-image-status')).toHaveTextContent('1:42');
  });

  it('returns null for an external stack', () => {
    const item = new ExternalStackViewModel(
      'ext',
      StackType.DockerCompose,
      Date.now()
    );
    const cell = imageNotificationColumn.cell as (
      ctx: CellContext<DecoratedStack, unknown>
    ) => React.ReactNode;
    const { container } = render(
      <>{cell({ row: { original: item } } as CellContext<DecoratedStack, unknown>)}</>
    );
    expect(container).toBeEmptyDOMElement();
  });
});
