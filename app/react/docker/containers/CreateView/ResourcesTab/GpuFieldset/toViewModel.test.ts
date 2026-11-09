import { describe, expect, it } from 'vitest';

import { getDefaultViewModel, toViewModel } from './toViewModel';

describe('REQ-CTR-16 GPU assignment toViewModel', () => {
  it('returns defaults when no GPU device request exists', () => {
    expect(toViewModel([])).toEqual(getDefaultViewModel());
    expect(toViewModel()).toEqual(getDefaultViewModel());
  });

  it('maps an all-GPU nvidia request', () => {
    expect(
      toViewModel([
        {
          Driver: 'nvidia',
          Count: -1,
          DeviceIDs: [],
          Capabilities: [['compute', 'utility']],
        },
      ])
    ).toEqual({
      enabled: true,
      useSpecific: false,
      selectedGPUs: ['all'],
      capabilities: ['compute', 'utility'],
    });
  });

  it('maps a specific GPU request discovered via capabilities', () => {
    expect(
      toViewModel([
        {
          Driver: '',
          Count: 0,
          DeviceIDs: ['0'],
          Capabilities: [['gpu', 'compute']],
        },
      ])
    ).toEqual({
      enabled: true,
      useSpecific: true,
      selectedGPUs: ['0'],
      capabilities: ['gpu', 'compute'],
    });
  });
});
