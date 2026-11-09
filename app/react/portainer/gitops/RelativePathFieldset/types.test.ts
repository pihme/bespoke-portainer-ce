import { describe, expect, it } from 'vitest';

import {
  getDefaultRelativePathModel,
  getPerDevConfigsFilterType,
} from './types';

describe('getDefaultRelativePathModel', () => {
  it('returns disabled relative-path defaults', () => {
    expect(getDefaultRelativePathModel()).toEqual({
      SupportRelativePath: false,
      FilesystemPath: '',
      PerDeviceConfigsGroupMatchType: '',
      PerDeviceConfigsMatchType: '',
      PerDeviceConfigsPath: '',
      SupportPerDeviceConfigs: false,
    });
  });
});

describe('getPerDevConfigsFilterType', () => {
  it('accepts file and dir values', () => {
    expect(getPerDevConfigsFilterType('file')).toBe('file');
    expect(getPerDevConfigsFilterType('dir')).toBe('dir');
  });

  it('maps unknown values to empty string', () => {
    expect(getPerDevConfigsFilterType('')).toBe('');
    expect(getPerDevConfigsFilterType('other')).toBe('');
  });
});
