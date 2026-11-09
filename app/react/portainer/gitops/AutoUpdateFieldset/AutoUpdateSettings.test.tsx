import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { AutoUpdateSettings } from './AutoUpdateSettings';

vi.mock('./WebhookSettings', () => ({
  WebhookSettings: ({ value }: { value: string }) => (
    <div data-cy="webhook-settings">{value}</div>
  ),
}));

vi.mock('./ForceDeploymentSwitch', () => ({
  ForceDeploymentSwitch: ({
    checked,
    onChange,
    label,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label?: string;
  }) => (
    <button
      type="button"
      data-cy="force-deploy"
      onClick={() => onChange(!checked)}
    >
      {label || 'Force redeployment'}
    </button>
  ),
}));

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

vi.mock('@@/Tip/TextTip', () => ({
  TextTip: ({ children }: { children: React.ReactNode }) => (
    <div data-cy="text-tip">{children}</div>
  ),
}));

const baseValue = {
  RepositoryAutomaticUpdates: true,
  ForcePullImage: false,
  RepositoryAutomaticUpdatesForce: false,
};

describe('AutoUpdateSettings', () => {
  it('renders webhook settings, tip, force-pull and force-deploy for Docker', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AutoUpdateSettings
        value={baseValue}
        onChange={onChange}
        showForcePullImage
        baseWebhookUrl="https://ex/hooks"
        webhookId="w1"
        environmentType="DOCKER"
      />
    );
    expect(screen.getByTestId('webhook-settings')).toHaveTextContent('w1');
    expect(screen.getByTestId('text-tip')).toBeVisible();
    expect(screen.getByTestId('switch-forcePullImage')).toBeVisible();
    expect(screen.getByTestId('force-deploy')).toHaveTextContent(
      'Force redeployment'
    );
    await user.click(screen.getByTestId('switch-forcePullImage'));
    expect(onChange).toHaveBeenCalledWith({ ForcePullImage: true });
    await user.click(screen.getByTestId('force-deploy'));
    expect(onChange).toHaveBeenCalledWith({
      RepositoryAutomaticUpdatesForce: true,
    });
  });

  it('hides force-pull and uses Kubernetes label', () => {
    render(
      <AutoUpdateSettings
        value={baseValue}
        onChange={vi.fn()}
        showForcePullImage={false}
        baseWebhookUrl="https://ex/hooks"
        webhookId="w1"
        environmentType="KUBERNETES"
      />
    );
    expect(screen.queryByTestId('switch-forcePullImage')).not.toBeInTheDocument();
    expect(screen.getByTestId('force-deploy')).toHaveTextContent(
      'Always apply manifest'
    );
  });
});
