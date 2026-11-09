import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildUrl,
  getGlobalDeploymentOptions,
  getPublicSettings,
  getSettings,
  updateSettings,
} from './settings.service';

const { get, put, parseAxiosError } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  parseAxiosError: vi.fn((e: unknown, msg: string) => new Error(msg)),
}));

vi.mock('@/portainer/services/axios/axios', () => ({
  default: { get, put },
  parseAxiosError: (e: unknown, msg: string) => parseAxiosError(e, msg),
}));

describe('settings.service KEEP helpers', () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
    parseAxiosError.mockClear();
  });

  it('buildUrl joins optional subResource and action', () => {
    expect(buildUrl()).toBe('settings');
    expect(buildUrl('public')).toBe('settings/public');
    expect(buildUrl('public', 'check')).toBe('settings/public/check');
  });

  it('getPublicSettings returns data and wraps failures', async () => {
    get.mockResolvedValue({ data: { GlobalDeploymentOptions: { a: 1 } } });
    await expect(getPublicSettings()).resolves.toEqual({
      GlobalDeploymentOptions: { a: 1 },
    });
    expect(get).toHaveBeenCalledWith('settings/public');

    get.mockRejectedValue(new Error('network'));
    await expect(getPublicSettings()).rejects.toThrow(
      'Unable to retrieve application settings'
    );
  });

  it('getGlobalDeploymentOptions reads the public settings field', async () => {
    get.mockResolvedValue({
      data: { GlobalDeploymentOptions: { hide: true } },
    });
    await expect(getGlobalDeploymentOptions()).resolves.toEqual({ hide: true });
  });

  it('getSettings returns data and wraps failures', async () => {
    get.mockResolvedValue({ data: { LogoURL: 'x' } });
    await expect(getSettings()).resolves.toEqual({ LogoURL: 'x' });
    expect(get).toHaveBeenCalledWith('settings');

    get.mockRejectedValue(new Error('network'));
    await expect(getSettings()).rejects.toThrow(
      'Unable to retrieve application settings'
    );
  });

  it('updateSettings puts the payload and wraps failures', async () => {
    put.mockResolvedValue({ data: { LogoURL: 'y' } });
    await expect(updateSettings({ LogoURL: 'y' })).resolves.toEqual({
      LogoURL: 'y',
    });
    expect(put).toHaveBeenCalledWith('settings', { LogoURL: 'y' });

    put.mockRejectedValue(new Error('network'));
    await expect(updateSettings({ LogoURL: 'z' })).rejects.toThrow(
      'Unable to update application settings'
    );
  });
});
