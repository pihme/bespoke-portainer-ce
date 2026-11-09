import { beforeEach, describe, expect, it, vi } from 'vitest';

const confirmMock = vi.fn();

vi.mock('@@/modals/confirm', () => ({
  confirm: (...args: unknown[]) => confirmMock(...args),
}));

import { confirmEnableTLSVerify, isGitConfigDiverged } from './utils';
import { RepoConfigResponse } from './types';

const baseConfig: RepoConfigResponse = {
  URL: 'https://github.com/org/repo',
  ReferenceName: 'refs/heads/main',
  ConfigFilePath: 'docker-compose.yml',
  ConfigHash: 'abc',
  TLSSkipVerify: false,
};

describe('gitops utils (backwards compatibility)', () => {
  beforeEach(() => {
    confirmMock.mockReset();
    confirmMock.mockResolvedValue(true);
  });

  it('confirmEnableTLSVerify opens the TLS verification confirm modal', async () => {
    await expect(confirmEnableTLSVerify()).resolves.toBe(true);
    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Enable TLS Verification?',
      })
    );
  });

  it('isGitConfigDiverged is false without deployment info or matching fields', () => {
    expect(isGitConfigDiverged(baseConfig, null)).toBe(false);
    expect(isGitConfigDiverged(baseConfig, undefined)).toBe(false);
    expect(
      isGitConfigDiverged(baseConfig, {
        RepositoryURL: baseConfig.URL,
        ReferenceName: baseConfig.ReferenceName,
        ConfigFilePath: baseConfig.ConfigFilePath,
      } as never)
    ).toBe(false);
  });

  it('isGitConfigDiverged detects URL, ref and file path changes', () => {
    expect(
      isGitConfigDiverged(baseConfig, {
        RepositoryURL: 'https://github.com/other/repo',
      } as never)
    ).toBe(true);
    expect(
      isGitConfigDiverged(baseConfig, {
        ReferenceName: 'refs/heads/other',
      } as never)
    ).toBe(true);
    expect(
      isGitConfigDiverged(baseConfig, {
        ConfigFilePath: 'other.yml',
      } as never)
    ).toBe(true);
  });
});
