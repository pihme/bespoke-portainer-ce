import { describe, expect, it } from 'vitest';

import { CreateContainerRequest } from '../types';

import { toRequest } from './toRequest';
import { Values } from './types';

describe('REQ-CTR-09 volumes toRequest for create form', () => {
  const base: CreateContainerRequest = {
    HostConfig: {},
    NetworkingConfig: {},
  };

  it('filters incomplete rows and builds binds and Volumes', () => {
    const values: Values = [
      {
        type: 'volume',
        name: 'data',
        containerPath: '/data',
        readOnly: false,
      },
      {
        type: 'bind',
        name: '/host/cfg',
        containerPath: '/cfg',
        readOnly: true,
      },
      {
        type: 'volume',
        name: '',
        containerPath: '/skip',
        readOnly: false,
      },
      {
        type: 'volume',
        name: 'orphan',
        containerPath: '',
        readOnly: false,
      },
    ];

    const result = toRequest(base, values);

    expect(result.Volumes).toEqual({
      '/data': {},
      '/cfg': {},
    });
    expect(result.HostConfig.Binds).toEqual([
      'data:/data',
      '/host/cfg:/cfg:ro',
    ]);
  });

  it('returns empty volumes when nothing is valid', () => {
    const result = toRequest(base, [
      {
        type: 'volume',
        name: '',
        containerPath: '',
        readOnly: false,
      },
    ]);

    expect(result.Volumes).toEqual({});
    expect(result.HostConfig.Binds).toEqual([]);
  });
});
