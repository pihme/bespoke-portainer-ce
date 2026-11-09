import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { UserViewModel } from '@/portainer/models/user';
import { withUserProvider } from '@/react/test-utils/withUserProvider';
import { notificationsStore } from '@/react/portainer/notifications/notifications-store';

vi.mock('@uirouter/react', () => ({
  useSref: () => ({ href: '#/notifications', onClick: vi.fn() }),
}));

vi.mock('@@/Link', () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="#">{children}</a>
  ),
}));

import { NotificationsMenu } from './NotificationsMenu';

describe('NotificationsMenu', () => {
  it('shows an empty state when the user has no notifications', async () => {
    const user = userEvent.setup();
    const account = new UserViewModel({ Id: 7, Username: 'admin' });
    notificationsStore.setState({ userNotifications: { 7: [] } });
    const Wrapped = withUserProvider(NotificationsMenu, account);
    render(<Wrapped />);
    await user.click(screen.getByLabelText('Notifications menu toggle'));
    expect(screen.getByText('You have no notifications yet.')).toBeVisible();
  });

  it('lists notifications and clears them', async () => {
    const user = userEvent.setup();
    const account = new UserViewModel({ Id: 7, Username: 'admin' });
    const clearSpy = vi.spyOn(notificationsStore.getState(), 'clearUserNotifications');
    notificationsStore.setState({
      userNotifications: {
        7: [
          {
            id: 'n1',
            title: 'Stack deployed',
            details: 'ok',
            type: 'success',
            timeStamp: new Date(Date.now() - 120_000),
          },
          {
            id: 'n2',
            title: 'Failed',
            details: 'boom',
            type: 'error',
            timeStamp: new Date(Date.now() - 3_600_000 * 2),
          },
        ],
      },
    });

    const Wrapped = withUserProvider(NotificationsMenu, account);
    render(<Wrapped />);
    await user.click(screen.getByLabelText('Notifications menu toggle'));
    expect(screen.getByText('Stack deployed')).toBeVisible();
    expect(screen.getByText('Failed')).toBeVisible();

    await user.click(screen.getByText('Clear all'));
    expect(clearSpy).toHaveBeenCalledWith(7);
    clearSpy.mockRestore();
  });
});
