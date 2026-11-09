import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { ListView } from './ListView';

vi.mock('@@/PageHeader', () => ({
  PageHeader: ({
    title,
    children,
  }: {
    title: string;
    children?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));
vi.mock('@@/buttons', () => ({
  AddButton: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));
vi.mock('./EnvironmentGroupsTable/EnvironmentGroupsTable', () => ({
  EnvironmentGroupsTable: () => <div data-cy="groups-table">table</div>,
}));

describe('REQ-ENV-03 environment groups ListView', () => {
  it('renders the header, add button and table', () => {
    render(<ListView />);
    expect(screen.getByText('Environment Groups')).toBeVisible();
    expect(screen.getByText('Add group')).toBeVisible();
    expect(screen.getByTestId('groups-table')).toBeVisible();
  });
});
