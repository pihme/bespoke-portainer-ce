import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ResourceControlOwnership } from '@/react/portainer/access-control/types';

import {
  createOwnershipColumn,
  ownershipIcon,
} from './createOwnershipColumn';
import {
  ImageUpToDateTooltip,
  TableColumnHeaderImageUpToDate,
} from './TableColumnHeaderImageUpToDate';

const envState = vi.hoisted(() => ({
  enableNotification: false as boolean | undefined,
}));

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

vi.mock('@/react/portainer/environments/queries', () => ({
  useEnvironment: (
    _id: number,
    select: (env: { EnableImageNotification?: boolean }) => unknown
  ) => ({
    data: select({ EnableImageNotification: envState.enableNotification }),
  }),
}));

vi.mock('@@/datatables/TableHeaderCell', () => ({
  TableColumnHeaderAngular: ({
    children,
    colTitle,
  }: {
    children?: React.ReactNode;
    colTitle?: string;
  }) => (
    <div data-cy="header">
      {colTitle}
      {children}
    </div>
  ),
}));

describe('docker datatable helpers', () => {
  it('builds an ownership column with icons for each ownership kind', () => {
    const column = createOwnershipColumn(false);
    expect(column.id).toBe('ownership');
    expect(column.enableHiding).toBe(false);

    const accessor = column.accessorFn as (row: {
      ResourceControl?: { Ownership: ResourceControlOwnership };
    }) => ResourceControlOwnership;
    expect(accessor({})).toBe(ResourceControlOwnership.ADMINISTRATORS);
    expect(
      accessor({
        ResourceControl: { Ownership: ResourceControlOwnership.PRIVATE },
      })
    ).toBe(ResourceControlOwnership.PRIVATE);

    const Cell = column.cell as (ctx: {
      getValue: () => ResourceControlOwnership;
    }) => React.ReactNode;
    for (const ownership of [
      ResourceControlOwnership.PRIVATE,
      ResourceControlOwnership.ADMINISTRATORS,
      ResourceControlOwnership.RESTRICTED,
      ResourceControlOwnership.PUBLIC,
    ]) {
      const { unmount } = render(
        <>{Cell({ getValue: () => ownership })}</>
      );
      expect(screen.getByText(ownership)).toBeVisible();
      unmount();
    }

    expect(ownershipIcon(ResourceControlOwnership.PRIVATE)).toBeTruthy();
    expect(ownershipIcon(ResourceControlOwnership.ADMINISTRATORS)).toBeTruthy();
    expect(ownershipIcon(ResourceControlOwnership.RESTRICTED)).toBeTruthy();
    expect(ownershipIcon('unknown' as ResourceControlOwnership)).toBeTruthy();
  });

  it('renders the image up-to-date header and hides tooltip without notification', () => {
    envState.enableNotification = false;
    render(
      <TableColumnHeaderImageUpToDate
        canSort
        isSorted={false}
        colTitle="Image"
      />
    );
    expect(screen.getByTestId('header')).toHaveTextContent('Image');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('returns null from ImageUpToDateTooltip on CE even when notifications are enabled', () => {
    envState.enableNotification = true;
    const { container } = render(<ImageUpToDateTooltip />);
    expect(container).toBeEmptyDOMElement();
  });
});
