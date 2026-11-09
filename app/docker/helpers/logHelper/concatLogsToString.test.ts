import { describe, it, expect } from 'vitest';

import { concatLogsToString } from './concatLogsToString';
import { NEW_LINE_BREAKER } from './constants';
import { FormattedLine } from './types';

describe('REQ-CTR-10 concatLogsToString container log export', () => {
  it('joins formatted lines with the platform newline breaker', () => {
    const logs: FormattedLine[] = [
      { line: 'one', spans: [{ text: 'one' }] },
      { line: 'two', spans: [{ text: 'two' }] },
    ];
    expect(concatLogsToString(logs)).toBe(
      `one${NEW_LINE_BREAKER}two${NEW_LINE_BREAKER}`
    );
  });

  it('uses a custom format function when provided', () => {
    const logs: FormattedLine[] = [
      { line: 'raw', spans: [{ text: 'raw' }] },
    ];
    expect(
      concatLogsToString(logs, (formatted) => `APP ${formatted.line}`)
    ).toBe(`APP raw${NEW_LINE_BREAKER}`);
  });

  it('returns an empty string for an empty log list', () => {
    expect(concatLogsToString([])).toBe('');
  });
});
