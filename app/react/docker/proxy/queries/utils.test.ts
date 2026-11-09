import { describe, expect, it } from 'vitest';

import { agentTargetHeader } from '@/portainer/services/axios/axios';

import {
  formatArrayQueryParamsForDockerAPI,
  withAgentManagerOperationHeader,
  withAgentTargetHeader,
  withFiltersQueryParam,
  withRegistryAuthHeader,
} from './utils';

describe('proxy query utils (backwards compatibility)', () => {
  it('withFiltersQueryParam stringifies filters when provided', () => {
    expect(withFiltersQueryParam({ label: ['a=b'] })).toEqual({
      filters: JSON.stringify({ label: ['a=b'] }),
    });
    expect(withFiltersQueryParam(undefined)).toEqual({ filters: undefined });
  });

  it('withRegistryAuthHeader base64-encodes the registry id when set', () => {
    const header = withRegistryAuthHeader(7);
    expect(header['X-Registry-Auth']).toBe(
      window.btoa(JSON.stringify({ registryId: 7 }))
    );
    expect(withRegistryAuthHeader(undefined)).toEqual({});
  });

  it('withAgentTargetHeader sets the agent target when a node is named', () => {
    expect(withAgentTargetHeader('node-a')).toEqual({
      [agentTargetHeader]: 'node-a',
    });
    expect(withAgentTargetHeader(undefined)).toEqual({});
    expect(withAgentTargetHeader('')).toEqual({});
  });

  it('withAgentManagerOperationHeader sets the manager flag when true', () => {
    expect(withAgentManagerOperationHeader(true)).toEqual({
      'X-PortainerAgent-ManagerOperation': '1',
    });
    expect(withAgentManagerOperationHeader(false)).toEqual({});
    expect(withAgentManagerOperationHeader(undefined)).toEqual({});
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
