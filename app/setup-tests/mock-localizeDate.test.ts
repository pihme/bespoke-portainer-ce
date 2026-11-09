import { describe, expect, it } from 'vitest';

import { localizeDate } from '@/react/common/date-utils';

import { mockLocalizeDate } from './mock-localizeDate';

describe('mock-localizeDate (backwards compatibility)', () => {
  it('formats dates in en-US UTC via the mock', () => {
    const formatted = localizeDate(new Date('2024-01-02T15:04:00Z'));
    expect(formatted).toMatch(/Jan/);
    expect(formatted).toMatch(/2024/);
    expect(mockLocalizeDate()).toBeUndefined();
  });
});
