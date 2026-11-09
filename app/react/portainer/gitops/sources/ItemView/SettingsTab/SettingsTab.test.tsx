import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SourceDetail } from '../../queries/useSource';

import { SettingsTab } from './SettingsTab';

vi.mock('./EditForm/SettingsForm', () => ({
  SettingsForm: ({ onCancel }: { onCancel: () => void }) => (
    <div data-cy="settings-form-stub">
      <button type="button" onClick={onCancel} data-cy="stub-cancel">
        Cancel edit
      </button>
    </div>
  ),
}));

vi.mock('./ConnectionDetailsWidget', () => ({
  ConnectionDetailsWidget: () => (
    <div data-cy="connection-details">Connection</div>
  ),
}));

vi.mock('./AuthWidget', () => ({
  AuthWidget: () => <div data-cy="auth-widget">Auth</div>,
}));

vi.mock('./PollingWidget', () => ({
  PollingWidget: ({ interval }: { interval?: string }) => (
    <div data-cy="polling-widget">{interval ?? 'off'}</div>
  ),
}));

vi.mock('./SyncStatusWidget', () => ({
  SyncStatusWidget: () => <div data-cy="sync-status">Sync</div>,
}));

const source: SourceDetail = {
  id: 3,
  name: 'src',
  type: 'git',
  url: 'https://example.com/repo.git',
  status: 'healthy',
  connection: {},
  interval: '5m',
};

describe('REQ-GIT-01 SettingsTab', () => {
  it('TestREQ_GIT_01_shows_read_only_connection_widgets_when_not_editing', () => {
    render(
      <SettingsTab
        source={source}
        isEditing={false}
        onEditingChange={() => {}}
      />
    );

    expect(screen.getByTestId('connection-details')).toBeVisible();
    expect(screen.getByTestId('auth-widget')).toBeVisible();
    expect(screen.getByTestId('polling-widget')).toHaveTextContent('5m');
    expect(screen.getByTestId('sync-status')).toBeVisible();
    expect(screen.queryByTestId('settings-form-stub')).not.toBeInTheDocument();
  });

  it('TestREQ_GIT_01_shows_settings_form_when_editing_and_cancels', async () => {
    const user = userEvent.setup();
    const onEditingChange = vi.fn();
    render(
      <SettingsTab
        source={source}
        isEditing
        onEditingChange={onEditingChange}
      />
    );

    expect(screen.getByTestId('settings-form-stub')).toBeVisible();
    expect(screen.queryByTestId('connection-details')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('stub-cancel'));
    expect(onEditingChange).toHaveBeenCalledWith(false);
  });
});
