import { describe, expect, it } from 'vitest';

import {
  formatArrayQueryParamsForDockerAPI,
  withFiltersQueryParam,
} from './utils';
import * as utils from './utils';

describe('proxy query utils (backwards compatibility)', () => {
  it('withFiltersQueryParam stringifies filters when provided', () => {
    expect(withFiltersQueryParam({ label: ['a=b'] })).toEqual({
      filters: JSON.stringify({ label: ['a=b'] }),
    });
    expect(withFiltersQueryParam(undefined)).toEqual({ filters: undefined });
  });

  it('REQ-TAI-005 builds no X-Registry-Auth header', () => {
    expect('withRegistryAuthHeader' in utils).toBe(false);
  });

  it('REQ-TAI-007 builds no agent target or manager operation header', () => {
    expect('withAgentTargetHeader' in utils).toBe(false);
    expect('withAgentManagerOperationHeader' in utils).toBe(false);
  });

  it('formatArrayQueryParamsForDockerAPI repeats keys without brackets', () => {
    expect(
      formatArrayQueryParamsForDockerAPI({
        names: ['nginx:latest', 'redis:alpine'],
        force: true,
      })
    ).toBe('names=nginx:latest&names=redis:alpine&force=true');
  });
});
