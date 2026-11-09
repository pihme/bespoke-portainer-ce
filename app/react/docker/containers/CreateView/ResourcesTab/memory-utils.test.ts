import { describe, expect, it } from 'vitest';

import {
  round,
  toConfigCpu,
  toConfigMemory,
  toViewModelCpu,
  toViewModelMemory,
} from './memory-utils';

describe('REQ-CTR-03 resource memory and cpu helpers', () => {
  it('converts MB values to Docker bytes and clamps negatives', () => {
    expect(toConfigMemory(64)).toBe(64 * 1024 * 1024);
    expect(toConfigMemory(-1)).toBe(0);
    expect(toViewModelMemory(128 * 1024 * 1024)).toBe(128);
    expect(toViewModelMemory(-10)).toBe(0);
    expect(toViewModelMemory()).toBe(0);
  });

  it('converts CPU fractions to NanoCpus and clamps negatives', () => {
    expect(toConfigCpu(1.5)).toBe(1.5 * 1_000_000_000);
    expect(toConfigCpu(-2)).toBe(0);
    expect(toViewModelCpu(2_000_000_000)).toBe(2);
    expect(toViewModelCpu(-1)).toBe(0);
    expect(toViewModelCpu()).toBe(0);
  });

  it('rounds to the requested decimal places', () => {
    expect(round(1.23456, 3)).toBe(1.235);
  });
});
