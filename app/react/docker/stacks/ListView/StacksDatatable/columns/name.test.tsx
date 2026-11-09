import { CellContext, Column, Row } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createMockStack } from '@/react-tools/test-mocks';
import { StackStatus, StackType } from '@/react/common/stacks/types';
import { ExternalStackViewModel } from '@/react/docker/stacks/view-models/external-stack';
import { StackViewModel } from '@/react/docker/stacks/view-models/stack';

import { DecoratedStack } from '../types';

const adminState = vi.hoisted(() => ({ isAdmin: true }));

vi.mock('@/react/hooks/useUser', () => ({
  useIsEdgeAdmin: () => ({ isAdmin: adminState.isAdmin, isLoading: false }),
}));

vi.mock('@uirouter/react', () => ({
  useSref: () => ({ href: '#/stack', onClick: vi.fn() }),
}));

import { name } from './name';

function renderName(item: DecoratedStack) {
  const cell = name.cell as (
    ctx: CellContext<DecoratedStack, string>
  ) => React.ReactNode;
  return render(
    <>
      {cell({
        row: { original: item },
      } as CellContext<DecoratedStack, string>)}
    </>
  );
}

describe('stacks name column', () => {
  it('exports the name accessor column', () => {
    expect(name.id).toBe('name');
    expect(name.header).toBe('Name');
  });

  it('links a regular active Compose stack without a status label', () => {
    const item = new StackViewModel(
      createMockStack({ Name: 'compose-app', Status: StackStatus.Active })
    );
    renderName(item);
    expect(screen.getByText('compose-app')).toBeVisible();
    expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
  });

  it('shows Inactive, Deploying, and Error labels for regular stacks', () => {
    const inactive = new StackViewModel(
      createMockStack({ Name: 'a', Status: StackStatus.Inactive })
    );
    const { unmount } = renderName(inactive);
    expect(screen.getByText('Inactive')).toBeVisible();
    unmount();

    const deploying = new StackViewModel(
      createMockStack({ Name: 'b', Status: StackStatus.Deploying })
    );
    const r2 = renderName(deploying);
    expect(screen.getByText('Deploying...')).toBeVisible();
    r2.unmount();

    const errored = new StackViewModel(
      createMockStack({ Name: 'c', Status: StackStatus.Error })
    );
    renderName(errored);
    expect(screen.getByText('Error')).toBeVisible();
  });

  it('links an external stack', () => {
    const item = new ExternalStackViewModel(
      'external-compose',
      StackType.DockerCompose,
      Date.now()
    );
    renderName(item);
    expect(screen.getByText('external-compose')).toBeVisible();
  });

  it('filters by stack activity', () => {
    const filterFn = name.filterFn as (
      row: Row<DecoratedStack>,
      columnId: string,
      filterValue: string[]
    ) => boolean;

    const active = new StackViewModel(
      createMockStack({ Status: StackStatus.Active })
    );
    const row = { original: active } as Row<DecoratedStack>;

    expect(filterFn(row, 'name', [])).toBe(true);
    expect(filterFn(row, 'name', ['Active Stacks'])).toBe(true);
    expect(filterFn(row, 'name', ['Inactive Stacks'])).toBe(false);

    const external = new ExternalStackViewModel(
      'ext',
      StackType.DockerCompose,
      Date.now()
    );
    expect(
      filterFn({ original: external } as Row<DecoratedStack>, 'name', [
        'Active Stacks',
      ])
    ).toBe(true);
  });


  it('shows plain text for an orphaned stack when the user is not admin', () => {
    adminState.isAdmin = false;
    const item = new StackViewModel(createMockStack({ Name: 'orphan' }), true);
    renderName(item);
    expect(screen.getByText('orphan')).toBeVisible();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    adminState.isAdmin = true;
  });

  it('renders the activity filter UI from column meta', async () => {
    const user = userEvent.setup();
    const Filter = name.meta?.filter as (props: {
      column: Column<DecoratedStack>;
    }) => React.ReactNode;
    const setFilterValue = vi.fn();
    render(
      <Filter
        column={
          {
            id: 'name',
            getFilterValue: () => ['Active Stacks'],
            setFilterValue,
          } as unknown as Column<DecoratedStack>
        }
      />
    );
    await user.click(screen.getByRole('button', { name: /filter/i }));
    expect(screen.getByText(/filter by activity/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Active Stacks')).toBeInTheDocument();
  });
});
