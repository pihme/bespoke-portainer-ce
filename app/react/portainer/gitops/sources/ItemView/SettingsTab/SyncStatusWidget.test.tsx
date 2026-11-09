import { render, screen } from '@testing-library/react';

import { SourceDetail } from '../../queries/useSource';

import { SyncStatusWidget } from './SyncStatusWidget';

const baseSource: SourceDetail = {
  id: 11,
  name: 'compose-repo',
  type: 'git',
  url: 'https://github.com/org/compose.git',
  status: 'healthy',
  connection: {},
  lastSync: 1_700_000_000,
};

describe('REQ-GIT-01 SyncStatusWidget', () => {
  it('TestREQ_GIT_01_shows_healthy_status_and_last_sync', () => {
    render(<SyncStatusWidget source={baseSource} />);

    expect(screen.getByText('Sync Status')).toBeVisible();
    expect(screen.getByTestId('source-status')).toHaveTextContent(/Healthy/i);
    expect(screen.getByTestId('source-last-sync')).not.toHaveTextContent('-');
  });

  it('TestREQ_GIT_01_shows_error_alert_and_danger_status', () => {
    render(
      <SyncStatusWidget
        source={{
          ...baseSource,
          status: 'error',
          error: 'clone failed',
          lastSync: undefined,
        }}
      />
    );

    expect(screen.getByTestId('source-status')).toHaveTextContent(/Error/i);
    expect(screen.getByTestId('source-last-sync')).toHaveTextContent('-');
    expect(screen.getByText('clone failed')).toBeVisible();
  });

  it('TestREQ_GIT_01_maps_syncing_paused_and_unknown_status_colors', () => {
    const { rerender } = render(
      <SyncStatusWidget source={{ ...baseSource, status: 'syncing' }} />
    );
    expect(screen.getByTestId('source-status')).toHaveTextContent(/Syncing/i);

    rerender(
      <SyncStatusWidget source={{ ...baseSource, status: 'paused' }} />
    );
    expect(screen.getByTestId('source-status')).toHaveTextContent(/Paused/i);

    rerender(
      <SyncStatusWidget source={{ ...baseSource, status: 'unknown' }} />
    );
    expect(screen.getByTestId('source-status')).toHaveTextContent(/Unknown/i);

    rerender(
      <SyncStatusWidget
        source={{
          ...baseSource,
          status: undefined as unknown as SourceDetail['status'],
        }}
      />
    );
    expect(screen.getByText('-')).toBeVisible();
  });
});
