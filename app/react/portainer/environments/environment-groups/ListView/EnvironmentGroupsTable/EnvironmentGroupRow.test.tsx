import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { EnvironmentGroupRow } from './EnvironmentGroupRow';

const go = vi.fn();

vi.mock('@uirouter/react', () => ({
  useRouter: () => ({ stateService: { go } }),
}));

vi.mock('../../utils/getPlatformLabel', () => ({
  isUngoverned: (group: { Name: string }) => group.Name === 'ungoverned',
}));

vi.mock('../../components/EnvironmentTypeBreakdown', () => ({
  EnvironmentTypeBreakdown: () => <span>breakdown</span>,
}));

vi.mock('../../components/PlatformBadge', () => ({
  PlatformBadge: () => <span>platform</span>,
}));

vi.mock('@@/Link', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock('@@/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock('@@/buttons', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

const governed = {
  Id: 5,
  Name: 'dev',
  TagIds: [1, 2],
} as never;

describe('EnvironmentGroupRow navigation', () => {
  beforeEach(() => {
    go.mockReset();
  });

  it('navigates on click and keyboard for governed groups', async () => {
    const user = userEvent.setup();
    render(
      <EnvironmentGroupRow
        group={governed}
        tags={[
          { ID: 1, Name: 'prod' },
          { ID: 99, Name: 'other' },
        ] as never}
      />
    );
    expect(screen.getByText('prod')).toBeVisible();
    expect(screen.getByText('Tag 2')).toBeVisible();
    await user.click(screen.getByTestId('environment-group-row-dev'));
    expect(go).toHaveBeenCalledWith('portainer.groups.group', { id: 5 });

    go.mockReset();
    await user.type(screen.getByTestId('environment-group-row-dev'), '{Enter}');
    expect(go).toHaveBeenCalled();
  });

  it('does not navigate for ungoverned groups', async () => {
    const user = userEvent.setup();
    render(
      <EnvironmentGroupRow
        group={{ Id: 1, Name: 'ungoverned' } as never}
      />
    );
    await user.click(screen.getByTestId('environment-group-row-ungoverned'));
    expect(go).not.toHaveBeenCalled();
    expect(screen.queryByText('Manage access')).not.toBeInTheDocument();
  });
});
