import { describe, expect, it } from 'vitest';

import { ContainerDetailsJSON } from '../../queries/useContainer';

import { getDefaultViewModel, toViewModel } from './toViewModel';

describe('REQ-CTR-03 env vars toViewModel', () => {
  it('parses Config.Env into name/value rows', () => {
    const config: ContainerDetailsJSON = {
      Config: { Env: ['FOO=bar', 'EMPTY=', 'BARE'] },
    };

    expect(toViewModel(config)).toEqual([
      { name: 'FOO', value: 'bar', needsDeletion: false },
      { name: 'EMPTY', value: '', needsDeletion: false },
      { name: 'BARE' },
    ]);
  });

  it('defaults to an empty list', () => {
    expect(toViewModel({})).toEqual([]);
    expect(getDefaultViewModel()).toEqual([]);
  });
});
