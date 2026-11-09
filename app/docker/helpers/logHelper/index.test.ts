import { describe, it, expect } from 'vitest';

import * as logHelper from './index';
import { formatLogs } from './formatLogs';
import { concatLogsToString } from './concatLogsToString';
import { NEW_LINE_BREAKER } from './constants';

describe('REQ-CTR-10 logHelper public exports', () => {
  it('re-exports formatLogs, concatLogsToString and NEW_LINE_BREAKER', () => {
    expect(logHelper.formatLogs).toBe(formatLogs);
    expect(logHelper.concatLogsToString).toBe(concatLogsToString);
    expect(logHelper.NEW_LINE_BREAKER).toBe(NEW_LINE_BREAKER);
  });
});
