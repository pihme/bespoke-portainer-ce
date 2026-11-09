import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { AutoUpdateFieldset } from './AutoUpdateFieldset';

vi.mock('@@/form-components/SwitchField', () => ({
  SwitchField: ({
    checked,
    onChange,
    label,
    name,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    name: string;
  }) => (
    <button
      type="button"
      data-cy={`switch-${name}`}
      onClick={() => onChange(!checked)}
    >
      {label}:{String(checked)}
    </button>
  ),
}));

vi.mock('./AutoUpdateSettings', () => ({
  AutoUpdateSettings: ({
    webhookId,
    environmentType,
  }: {
    webhookId: string;
    environmentType?: string;
  }) => (
    <div data-cy="auto-update-settings">
      {webhookId}:{environmentType || 'none'}
    </div>
  ),
}));

describe('REQ-STK-09 AutoUpdateFieldset', () => {
  it('toggles webhook creation and reveals settings when enabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value = {
      RepositoryAutomaticUpdates: false,
      ForcePullImage: false,
      RepositoryAutomaticUpdatesForce: false,
    };
    const { rerender } = render(
      <AutoUpdateFieldset
        value={value}
        onChange={onChange}
        baseWebhookUrl="https://ex/hooks"
        webhookId="hook-9"
      />
    );
    expect(screen.queryByTestId('auto-update-settings')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('switch-gitopsWebhook'));
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      RepositoryAutomaticUpdates: true,
    });

    rerender(
      <AutoUpdateFieldset
        value={{ ...value, RepositoryAutomaticUpdates: true }}
        onChange={onChange}
        baseWebhookUrl="https://ex/hooks"
        webhookId="hook-9"
        environmentType="DOCKER"
      />
    );
    expect(screen.getByTestId('auto-update-settings')).toHaveTextContent(
      'hook-9:DOCKER'
    );
  });
});
