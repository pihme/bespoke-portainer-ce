import { describe, expect, it } from 'vitest';

import { ContainerDetailsJSON } from '../../queries/useContainer';

import { getDefaultViewModel, toViewModel } from './toViewModel';

describe('REQ-CTR-03 labels toViewModel', () => {
  it('maps Config.Labels into rows', () => {
    const config: ContainerDetailsJSON = {
      Config: { Labels: { a: '1', b: '2' } },
    };

    expect(toViewModel(config)).toEqual([
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
    ]);
  });

  it('returns an empty list when labels are missing', () => {
    expect(toViewModel({})).toEqual([]);
    expect(toViewModel({ Config: {} })).toEqual([]);
    expect(getDefaultViewModel()).toEqual([]);
  });
});
