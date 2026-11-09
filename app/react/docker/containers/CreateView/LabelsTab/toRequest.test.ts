import { describe, expect, it } from 'vitest';

import { CreateContainerRequest } from '../types';

import { toRequest } from './toRequest';

describe('REQ-CTR-03 labels toRequest', () => {
  it('keeps named labels and drops empty names', () => {
    const config: CreateContainerRequest = {
      HostConfig: {},
      NetworkingConfig: {},
    };

    expect(
      toRequest(config, [
        { name: 'com.example', value: 'one' },
        { name: '', value: 'skip' },
        { name: 'owner', value: '' },
      ]).Labels
    ).toEqual({
      'com.example': 'one',
      owner: '',
    });
  });
});
