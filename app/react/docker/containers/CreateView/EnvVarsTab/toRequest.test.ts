import { describe, expect, it } from 'vitest';

import { CreateContainerRequest } from '../types';

import { toRequest } from './toRequest';

describe('REQ-CTR-03 env vars toRequest', () => {
  it('converts env rows into Docker Env strings', () => {
    const config: CreateContainerRequest = {
      HostConfig: {},
      NetworkingConfig: {},
      Env: ['OLD=1'],
    };

    const result = toRequest(config, [
      { name: 'FOO', value: 'bar' },
      { name: 'EMPTY', value: '' },
      { name: '', value: 'skip' },
    ]);

    expect(result.Env).toEqual(['FOO=bar', 'EMPTY=']);
  });
});
