import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { AutoUpdateSettings } from './AutoUpdateSettings';

vi.mock('./WebhookSettings', () => ({
  WebhookSettings: ({ value }: { value: string }) => (
    <div data-cy="webhook-settings">{value}</div>
  ),
}));

vi.mock('@@/Tip/TextTip', () => ({
  TextTip: ({ children }: { children: React.ReactNode }) => (
    <div data-cy="text-tip">{children}</div>
  ),
}));

describe('AutoUpdateSettings', () => {
  it('renders the Git stack webhook settings and the overwrite tip', () => {
    render(
      <AutoUpdateSettings baseWebhookUrl="https://ex/hooks" webhookId="w1" />
    );
    expect(screen.getByTestId('webhook-settings')).toHaveTextContent('w1');
    expect(screen.getByTestId('text-tip')).toBeVisible();
  });

  it('REQ-TAI-012: has no BE-only Re-pull image or Force redeployment teaser', () => {
    render(
      <AutoUpdateSettings baseWebhookUrl="https://ex/hooks" webhookId="w1" />
    );
    expect(screen.queryByText(/Re-pull image/i)).toBeNull();
    expect(screen.queryByText(/Force redeployment/i)).toBeNull();
    expect(screen.queryByText(/Always apply manifest/i)).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
