import { describe, expect, it } from 'vitest';

import { toRequest, resourcesValidation } from './ResourcesFieldset';

describe('REQ-CTR-03 ResourcesFieldset helpers', () => {
  it('writes NanoCpus and memory fields onto HostConfig', () => {
    expect(
      toRequest(
        {},
        { reservation: 64, limit: 128, cpu: 0.5 }
      )
    ).toEqual({
      NanoCpus: 0.5 * 1_000_000_000,
      MemoryReservation: 64 * 1024 * 1024,
      Memory: 128 * 1024 * 1024,
    });
  });

  it('rejects memory above the configured max', async () => {
    await expect(
      resourcesValidation({ maxMemory: 100, maxCpu: 2 }).validate({
        reservation: 50,
        limit: 200,
        cpu: 1,
      })
    ).rejects.toThrow(/between 0 and 100/);
  });
});
