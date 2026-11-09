import { describe, it, expect } from 'vitest';

import { Colors, TIMESTAMP_LENGTH } from './types';

describe('REQ-CTR-10 log helper shared constants', () => {
  it('exposes a 31-character Docker timestamp length', () => {
    expect(TIMESTAMP_LENGTH).toBe(31);
    expect('2024-01-02T03:04:05.000000000Z ').toHaveLength(TIMESTAMP_LENGTH);
  });

  it('exposes CSS variable color tokens for structured logs', () => {
    expect(Colors.Grey).toContain('--text-log-viewer-color-json-grey');
    expect(Colors.Red).toContain('--text-log-viewer-color-json-red');
    expect(Colors.Blue).toContain('--text-log-viewer-color-json-blue');
    expect(Object.keys(Colors)).toEqual([
      'Grey',
      'Magenta',
      'Yellow',
      'Green',
      'Red',
      'Blue',
    ]);
  });
});
