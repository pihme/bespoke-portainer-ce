import { describe, expect, it } from 'vitest';

import { relativePathValidation } from './validation';

describe('relativePathValidation', () => {
  const schema = relativePathValidation();

  it('accepts the disabled default model', async () => {
    await expect(
      schema.validate({
        SupportRelativePath: false,
        FilesystemPath: '',
        SupportPerDeviceConfigs: false,
        PerDeviceConfigsPath: '',
        PerDeviceConfigsMatchType: '',
        PerDeviceConfigsGroupMatchType: '',
      })
    ).resolves.toMatchObject({
      SupportRelativePath: false,
      SupportPerDeviceConfigs: false,
    });
  });

  it('requires a filesystem path when relative paths are enabled', async () => {
    await expect(
      schema.validate({
        SupportRelativePath: true,
        FilesystemPath: '',
        SupportPerDeviceConfigs: false,
        PerDeviceConfigsPath: '',
        PerDeviceConfigsMatchType: '',
        PerDeviceConfigsGroupMatchType: '',
      })
    ).rejects.toThrow(/Local filesystem path is required/);
  });

  it('requires a directory when per-device configs are enabled', async () => {
    await expect(
      schema.validate({
        SupportRelativePath: true,
        FilesystemPath: '/mnt',
        SupportPerDeviceConfigs: true,
        PerDeviceConfigsPath: '',
        PerDeviceConfigsMatchType: 'file',
        PerDeviceConfigsGroupMatchType: '',
      })
    ).rejects.toThrow(/Directory is required/);
  });

  it('accepts enabled relative paths with a filesystem path', async () => {
    await expect(
      schema.validate({
        SupportRelativePath: true,
        FilesystemPath: '/mnt',
        SupportPerDeviceConfigs: false,
        PerDeviceConfigsPath: '',
        PerDeviceConfigsMatchType: '',
        PerDeviceConfigsGroupMatchType: '',
      })
    ).resolves.toMatchObject({
      SupportRelativePath: true,
      FilesystemPath: '/mnt',
    });
  });
});
