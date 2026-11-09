import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { useUIState } from '@/react/hooks/useUIState';

import { MotdPanel } from './MotdPanel';

describe('MotdPanel local home banner', () => {
  beforeEach(() => {
    useUIState.setState({
      dismissedInfoPanels: {},
      dismissedInfoHash: '',
      dismissedUpdateVersion: '',
    });
  });

  it('renders a Motd message for the local home view', async () => {
    server.use(
      http.get('/api/motd', () =>
        HttpResponse.json({
          Title: 'Welcome',
          Message: '<b>Hello local</b>',
          Hash: 'hash-local',
          Style: '.motd-body { color: red; }',
          ContentLayout: { 'background-color': '#fff' },
        })
      )
    );

    const Wrapped = withTestQueryProvider(MotdPanel);
    render(<Wrapped />);

    expect(await screen.findByText('Welcome')).toBeVisible();
    expect(screen.getByText('Hello local')).toBeVisible();
  });

  it('returns null when Motd message is empty', async () => {
    server.use(
      http.get('/api/motd', () =>
        HttpResponse.json({
          Title: 'Empty',
          Message: '',
          Hash: 'hash-empty',
        })
      )
    );

    const Wrapped = withTestQueryProvider(MotdPanel);
    const { container } = render(<Wrapped />);

    await waitFor(() => {
      expect(container.querySelector('.motd-body')).toBeNull();
    });
  });

  it('hides Motd when the hash was already dismissed', async () => {
    useUIState.setState({
      dismissedInfoPanels: {},
      dismissedInfoHash: 'hash-dismissed',
      dismissedUpdateVersion: '',
    });

    server.use(
      http.get('/api/motd', () =>
        HttpResponse.json({
          Title: 'Dismissed',
          Message: 'Should not show',
          Hash: 'hash-dismissed',
        })
      )
    );

    const Wrapped = withTestQueryProvider(MotdPanel);
    const { container } = render(<Wrapped />);

    await waitFor(() => {
      expect(container.textContent).not.toContain('Should not show');
    });
  });

  it('dismisses Motd and stores the hash', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/motd', () =>
        HttpResponse.json({
          Title: 'Dismiss me',
          Message: 'Closeable banner',
          Hash: 'hash-close',
        })
      )
    );

    const Wrapped = withTestQueryProvider(MotdPanel);
    render(<Wrapped />);

    expect(await screen.findByText('Dismiss me')).toBeVisible();

    const dismiss = screen.getByRole('button', { name: /dismiss/i });
    await user.click(dismiss);

    await waitFor(() => {
      expect(useUIState.getState().dismissedInfoHash).toBe('hash-close');
    });
  });
});
