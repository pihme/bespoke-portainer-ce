import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

import { useUIState } from '@/react/hooks/useUIState';

import { UpdateNotification } from './UpdateNotifications';

let versionData:
  | {
      UpdateAvailable: boolean;
      LatestVersion: string;
    }
  | undefined = {
  UpdateAvailable: true,
  LatestVersion: '2.28.0',
};

vi.mock('@/react/portainer/system/useSystemVersion', () => ({
  useSystemVersion: () => ({ data: versionData }),
}));

describe('UpdateNotification', () => {
  beforeEach(() => {
    versionData = { UpdateAvailable: true, LatestVersion: '2.28.0' };
    useUIState.setState({ dismissedUpdateVersion: '' });
  });

  it('renders nothing when no update is available', () => {
    versionData = { UpdateAvailable: false, LatestVersion: '' };
    const { container } = render(<UpdateNotification />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while version query has no data', () => {
    versionData = undefined;
    const { container } = render(<UpdateNotification />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows new version and release link', () => {
    render(<UpdateNotification />);
    expect(screen.getByText(/New version available 2.28.0/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /See what's new/i });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/portainer/portainer/releases/tag/2.28.0'
    );
  });

  it('dismisses the notification for the current version', () => {
    render(<UpdateNotification />);
    fireEvent.click(screen.getByText('Dismiss'));
    expect(useUIState.getState().dismissedUpdateVersion).toBe('2.28.0');
  });

  it('hides when the latest version was already dismissed', () => {
    useUIState.setState({ dismissedUpdateVersion: '2.28.0' });
    const { container } = render(<UpdateNotification />);
    expect(container).toBeEmptyDOMElement();
  });
});
