import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { withTestRouter } from '@/react/test-utils/withRouter';
import { EnvironmentType } from '@/react/portainer/environments/types';
import { useUIState } from '@/react/hooks/useUIState';

vi.mock('@@/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('./EnvironmentHeader/EnvironmentHeader', () => ({
  EnvironmentHeader: () => <div data-cy="env-header">Environment header</div>,
}));

vi.mock('./EnvironmentList', () => ({
  EnvironmentList: ({
    onClickBrowse,
  }: {
    onClickBrowse: (env: { Type: EnvironmentType; Name: string }) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onClickBrowse({ Type: EnvironmentType.Docker, Name: 'local' })
        }
      >
        Browse local
      </button>
      <button
        type="button"
        onClick={() =>
          onClickBrowse({
            Type: EnvironmentType.EdgeAgentOnDocker,
            Name: 'edge',
          })
        }
      >
        Browse edge
      </button>
    </div>
  ),
}));

import { HomeView } from './HomeView';

describe('HomeView local shell', () => {
  beforeEach(() => {
    useUIState.setState({
      dismissedInfoPanels: {},
      dismissedInfoHash: '',
      dismissedUpdateVersion: '',
    });
  });

  it('renders the CE home shell with the environment list and no MOTD (REQ-TAI-012)', async () => {
    let motdRequested = false;
    server.use(
      http.get('/api/motd', () => {
        motdRequested = true;
        return HttpResponse.json({
          Title: 'Motd',
          Message: 'Local motd',
          Hash: 'home-hash',
        });
      })
    );
    const Wrapped = withTestQueryProvider(withTestRouter(HomeView));
    render(<Wrapped />);

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeVisible();
    expect(screen.queryByText('Local motd')).toBeNull();
    expect(motdRequested).toBe(false);
    expect(screen.getByText('Environment header')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Browse local' })).toBeVisible();
    expect(screen.queryByText(/Connecting to the Edge environment/i)).toBeNull();
  });

  it('keeps the local list when browsing a Docker environment', async () => {
    const user = userEvent.setup();
    const Wrapped = withTestQueryProvider(withTestRouter(HomeView));
    render(<Wrapped />);

    await screen.findByRole('button', { name: 'Browse local' });
    await user.click(screen.getByRole('button', { name: 'Browse local' }));

    expect(screen.getByText('Environment header')).toBeVisible();
    expect(screen.queryByText(/Connecting to the Edge environment/i)).toBeNull();
  });

  it('shows the edge spinner when browsing an edge environment', async () => {
    const user = userEvent.setup();
    const Wrapped = withTestQueryProvider(withTestRouter(HomeView));
    render(<Wrapped />);

    await screen.findByRole('button', { name: 'Browse edge' });
    await user.click(screen.getByRole('button', { name: 'Browse edge' }));

    expect(
      await screen.findByText(/Connecting to the Edge environment/i)
    ).toBeVisible();
  });
});
