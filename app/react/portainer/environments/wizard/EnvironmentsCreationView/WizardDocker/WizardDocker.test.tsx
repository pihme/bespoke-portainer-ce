import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { server } from '@/setup-tests/server';

vi.mock('./AgentTab', () => ({
  AgentTab: () => <div data-cy="agent-tab">agent</div>,
}));

import { WizardDocker } from './WizardDocker';

function renderWizard() {
  server.use(
    http.get('/api/endpoints', () =>
      HttpResponse.json([], {
        headers: { 'x-total-available': '0', 'x-total-count': '0' },
      })
    ),
    http.get('/api/settings', () => HttpResponse.json({})),
    http.get('/api/system/status', () =>
      HttpResponse.json({ Version: '2.19.0' })
    )
  );
  const Wrapped = withTestQueryProvider(
    withTestRouter(() => <WizardDocker onCreate={() => {}} />)
  );
  return render(<Wrapped />);
}

describe('WizardDocker', () => {
  it('shows the Socket tab for a local Docker environment', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByText('Socket'));
    expect(
      await screen.findByTestId('docker-socket-connect-button')
    ).toBeVisible();
  });

  it('shows the API tab for a Docker API environment', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByText('API'));
    expect(
      await screen.findByTestId('docker-aconnect-button')
    ).toBeVisible();
  });

  it('REQ-TAI-004 offers no Edge Agent option and opens on the Socket tab', async () => {
    renderWizard();
    expect(
      await screen.findByTestId('docker-socket-connect-button')
    ).toBeVisible();
    expect(screen.queryByText(/Edge Agent/)).not.toBeInTheDocument();
  });
});
