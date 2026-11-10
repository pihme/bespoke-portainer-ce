import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ApplicationSettingsPanel } from './ApplicationSettingsPanel';

const mutate = vi.fn();
const notifySuccess = vi.fn();
const onSuccess = vi.fn();

vi.mock('@/react/portainer/settings/queries', () => ({
  useUpdateSettingsMutation: () => ({ mutate, isLoading: false }),
}));
vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));
vi.mock('./LogoFieldset', () => ({
  LogoFieldset: () => <div>logo-fieldset</div>,
}));
vi.mock('./TemplatesUrlSection', () => ({
  TemplatesUrlSection: () => <div>templates-section</div>,
}));
vi.mock('@@/Widget', () => ({
  Widget: Object.assign(
    ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    {
      Title: ({ title }: { title: string }) => <h2>{title}</h2>,
      Body: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    }
  ),
}));

const settings = {
  EdgeAgentCheckinInterval: 5,
  CustomLoginBanner: '',
  LogoURL: '',
  SnapshotInterval: '5m',
  TemplatesURL: '',
} as never;

describe('REQ-SET-01 ApplicationSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits local application settings (REQ-TAI-004: no Edge poll frequency)', async () => {
    const user = userEvent.setup();
    mutate.mockImplementation((_payload, opts) => {
      opts?.onSuccess?.(settings);
    });
    render(
      <ApplicationSettingsPanel settings={settings} onSuccess={onSuccess} />
    );
    expect(screen.getByText('Application settings')).toBeVisible();
    expect(screen.getByText('logo-fieldset')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Save application settings/i }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).not.toHaveProperty(
      'EdgeAgentCheckinInterval'
    );
    expect(notifySuccess).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('REQ-TAI-012: has no login screen banner teaser and sends no CustomLoginBanner', async () => {
    const user = userEvent.setup();
    render(
      <ApplicationSettingsPanel settings={settings} onSuccess={onSuccess} />
    );
    expect(screen.queryByText(/Login screen banner/i)).toBeNull();
    expect(screen.queryByTestId('logo-banner-switch')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Save application settings/i }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.calls[0][0]).not.toHaveProperty('CustomLoginBanner');
  });
});
