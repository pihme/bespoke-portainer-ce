import { describe, expect, it, vi } from 'vitest';

import { localizeDate } from './date-utils';
import { getSchemeFromPort } from './network-utils';
import { processItemsInBatches } from './processItemsInBatches';
import { isVersionSmaller } from './semver-utils';

describe('common parent helpers', () => {
  it('localizeDate formats with AM/PM markers', () => {
    const formatted = localizeDate(new Date('2024-06-15T13:05:00'));
    expect(formatted).toMatch(/2024/);
    expect(formatted).toMatch(/PM|AM/);
  });

  it('getSchemeFromPort maps ports ending in 443 to https', () => {
    expect(getSchemeFromPort()).toBe('http');
    expect(getSchemeFromPort(80)).toBe('http');
    expect(getSchemeFromPort(443)).toBe('https');
    expect(getSchemeFromPort(8443)).toBe('https');
  });

  it('processItemsInBatches processes all items in chunks', async () => {
    const seen: number[] = [];
    await processItemsInBatches([1, 2, 3, 4], async (n) => {
      seen.push(n);
    }, 2);
    expect(seen).toEqual([1, 2, 3, 4]);
  });

  it('isVersionSmaller compares semver strings', () => {
    expect(isVersionSmaller('1.0.0', '2.0.0')).toBe(true);
    expect(isVersionSmaller('2.0.0', '1.0.0')).toBe(false);
  });
});
