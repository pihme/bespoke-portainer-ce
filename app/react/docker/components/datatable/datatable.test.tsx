import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
