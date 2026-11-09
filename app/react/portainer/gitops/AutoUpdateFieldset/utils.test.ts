import { describe, expect, it } from 'vitest';

import {
  getDefaultAutoUpdateValues,
  parseAutoUpdateResponse,
  transformAutoUpdateViewModel,
} from './utils';

describe('AutoUpdateFieldset utils', () => {
  it('returns disabled defaults', () => {
    expect(getDefaultAutoUpdateValues()).toEqual({
      RepositoryAutomaticUpdates: false,
      RepositoryAutomaticUpdatesForce: false,
      ForcePullImage: false,
    });
  });

  it('parses missing or empty responses as defaults', () => {
    expect(parseAutoUpdateResponse()).toEqual(getDefaultAutoUpdateValues());
    expect(parseAutoUpdateResponse(null)).toEqual(getDefaultAutoUpdateValues());
    expect(
      parseAutoUpdateResponse({
        Interval: '',
        Webhook: '',
        ForceUpdate: true,
        ForcePullImage: true,
      })
    ).toEqual(getDefaultAutoUpdateValues());
  });

  it('parses a webhook response into an enabled model', () => {
    expect(
      parseAutoUpdateResponse({
        Interval: '5m',
        Webhook: 'abc',
        ForceUpdate: true,
        ForcePullImage: false,
      })
    ).toEqual({
      RepositoryAutomaticUpdates: true,
      RepositoryAutomaticUpdatesForce: true,
      ForcePullImage: false,
    });
  });

  it('transforms an enabled model into an API payload', () => {
    expect(
      transformAutoUpdateViewModel(
        {
          RepositoryAutomaticUpdates: true,
          RepositoryAutomaticUpdatesForce: true,
          ForcePullImage: true,
        },
        'hook-1'
      )
    ).toEqual({
      Interval: '',
      Webhook: 'hook-1',
      ForceUpdate: true,
      ForcePullImage: true,
    });
  });

  it('returns null when auto-update is off or missing', () => {
    expect(transformAutoUpdateViewModel(undefined, 'hook-1')).toBeNull();
    expect(
      transformAutoUpdateViewModel(
        {
          RepositoryAutomaticUpdates: false,
          RepositoryAutomaticUpdatesForce: false,
          ForcePullImage: false,
        },
        'hook-1'
      )
    ).toBeNull();
  });

  it('requires a webhook id when auto-update is enabled', () => {
    expect(() =>
      transformAutoUpdateViewModel(
        {
          RepositoryAutomaticUpdates: true,
          RepositoryAutomaticUpdatesForce: false,
          ForcePullImage: false,
        },
        undefined
      )
    ).toThrow('Webhook ID is required');
  });
});
