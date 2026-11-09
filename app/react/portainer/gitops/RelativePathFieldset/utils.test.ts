import { describe, expect, it } from 'vitest';

import { EdgeStack } from '@/react/edge/edge-stacks/types';

import { dummyGitForm, parseRelativePathResponse } from './utils';

describe('dummyGitForm', () => {
  it('exposes empty git form defaults for path selectors', () => {
    expect(dummyGitForm).toEqual({
      SourceId: 0,
      AdditionalFiles: [],
      RepositoryReferenceName: '',
      ComposeFilePathInRepository: '',
    });
  });
});

describe('parseRelativePathResponse', () => {
  it('maps stack fields and fills missing values with defaults', () => {
    expect(
      parseRelativePathResponse({
        SupportRelativePath: true,
        FilesystemPath: '/mnt/data',
      } as EdgeStack)
    ).toEqual({
      SupportRelativePath: true,
      FilesystemPath: '/mnt/data',
      SupportPerDeviceConfigs: false,
      PerDeviceConfigsMatchType: '',
      PerDeviceConfigsGroupMatchType: '',
      PerDeviceConfigsPath: '',
    });
  });

  it('preserves per-device fields when present', () => {
    expect(
      parseRelativePathResponse({
        SupportRelativePath: false,
        FilesystemPath: '/opt',
        SupportPerDeviceConfigs: true,
        PerDeviceConfigsMatchType: 'file',
        PerDeviceConfigsGroupMatchType: 'dir',
        PerDeviceConfigsPath: 'config',
      } as EdgeStack)
    ).toEqual({
      SupportRelativePath: false,
      FilesystemPath: '/opt',
      SupportPerDeviceConfigs: true,
      PerDeviceConfigsMatchType: 'file',
      PerDeviceConfigsGroupMatchType: 'dir',
      PerDeviceConfigsPath: 'config',
    });
  });
});
