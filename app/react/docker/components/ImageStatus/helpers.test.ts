import { describe, expect, it } from 'vitest';
import { Loader } from 'lucide-react';

import { statusIcon } from './helpers';

describe('REQ-IMG-08 statusIcon helpers for local image status', () => {
  it('maps outdated updated processing and unknown statuses to icons', () => {
    expect(statusIcon({ Status: 'outdated', Message: '' })).toBeTruthy();
    expect(statusIcon({ Status: 'updated', Message: '' })).toBeTruthy();
    expect(statusIcon({ Status: 'processing', Message: '' })).toBe(Loader);
    expect(statusIcon({ Status: 'unknown', Message: '' })).toBeTruthy();
  });
});
