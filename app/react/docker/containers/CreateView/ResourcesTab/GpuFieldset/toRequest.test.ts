import { describe, expect, it } from 'vitest';

import { toRequest } from './toRequest';
import { Values } from './types';

describe('REQ-CTR-16 GPU assignment toRequest', () => {
  const other = [{ Driver: 'other', Count: 1, DeviceIDs: [], Capabilities: [] }];

  it('drops nvidia requests when GPU is disabled', () => {
    const gpu: Values = {
      enabled: false,
      useSpecific: false,
      selectedGPUs: ['all'],
      capabilities: ['compute'],
    };

    expect(
      toRequest(
        [
          ...other,
          {
            Driver: 'nvidia',
            Count: -1,
            DeviceIDs: [],
            Capabilities: [['gpu']],
          },
        ],
        gpu
      )
    ).toEqual(other);
  });

  it('requests all GPUs when enabled without specific selection', () => {
    const gpu: Values = {
      enabled: true,
      useSpecific: false,
      selectedGPUs: ['all'],
      capabilities: ['compute', 'utility'],
    };

    expect(toRequest(other, gpu)).toEqual([
      ...other,
      {
        Driver: 'nvidia',
        Count: -1,
        DeviceIDs: [],
        Capabilities: [['compute', 'utility']],
      },
    ]);
  });

  it('requests specific GPU ids when useSpecific is set', () => {
    const gpu: Values = {
      enabled: true,
      useSpecific: true,
      selectedGPUs: ['GPU-1', 'GPU-2'],
      capabilities: ['compute'],
    };

    expect(toRequest([], gpu)).toEqual([
      {
        Driver: 'nvidia',
        Count: 0,
        DeviceIDs: ['GPU-1', 'GPU-2'],
        Capabilities: [['compute']],
      },
    ]);
  });
});
