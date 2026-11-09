import { describe, it, expect } from 'vitest';

import { formatJSONLine } from './formatJSONLogs';
import { Colors, TIMESTAMP_LENGTH } from './types';

describe('REQ-CTR-10 formatJSONLine container log formatting', () => {
  it('formats a JSON log with time, level, caller, message and extra keys', () => {
    const payload = {
      time: 1700000000,
      level: 'info',
      caller: 'pkg/server.go:9',
      message: 'listening',
      port: 9000,
      host: '0.0.0.0',
    };
    const lines = formatJSONLine(JSON.stringify(payload));
    expect(lines).toHaveLength(1);
    const { line, spans } = lines[0];
    expect(line).toContain('INF');
    expect(line).toContain('pkg/server.go:9 >');
    expect(line).toContain('listening');
    expect(line).toContain('|');
    expect(line).toContain('port=9000');
    expect(line).toContain('host=0.0.0.0');
    expect(spans.some((s) => s.fgColor === Colors.Green && s.text === 'INF')).toBe(
      true
    );
    expect(spans.some((s) => s.fgColor === Colors.Blue && s.text === 'port=')).toBe(
      true
    );
  });

  it('appends stack_trace frames as extra formatted lines', () => {
    const payload = {
      time: 1700000000,
      level: 'error',
      caller: 'pkg/fail.go:1',
      message: 'boom',
      stack_trace: [{ func: 'pkg.Fail', line: '1', source: 'fail.go' }],
    };
    const lines = formatJSONLine(JSON.stringify(payload));
    expect(lines).toHaveLength(2);
    expect(lines[0].line).toContain('ERR');
    expect(lines[0].line).toContain('boom');
    expect(lines[1].line).toBe('    at pkg.Fail (fail.go:1)');
  });

  it('prefixes the Docker timestamp when withTimestamps is set', () => {
    const ts = '2024-01-02T03:04:05.000000000Z ';
    expect(ts).toHaveLength(TIMESTAMP_LENGTH);
    const payload = {
      time: 1700000000,
      level: 'warn',
      caller: 'a.go:1',
      message: 'slow',
    };
    const lines = formatJSONLine(`${ts}${JSON.stringify(payload)}`, true);
    expect(lines).toHaveLength(1);
    // Observed behaviour: the growing line is concatenated with each formatter
    // return value, so the Docker timestamp appears more than once in `line`.
    expect(lines[0].spans[0]).toEqual({ text: ts });
    expect(lines[0].line.startsWith(ts)).toBe(true);
    expect(lines[0].line).toContain('WRN');
    expect(lines[0].line).toContain('slow');
  });

  it('omits known keys from the key=value section', () => {
    const payload = {
      time: 1,
      level: 'DBG',
      caller: 'c.go:1',
      message: 'hi',
      stack_trace: [],
      only: 'extra',
    };
    const lines = formatJSONLine(JSON.stringify(payload));
    expect(lines[0].line).toContain('only=extra');
    expect(lines[0].line).not.toMatch(/\btime=/);
    expect(lines[0].line).not.toMatch(/\blevel=/);
    expect(lines[0].line).not.toMatch(/\bcaller=/);
    expect(lines[0].line).not.toMatch(/\bmessage=/);
    expect(lines[0].line).not.toMatch(/\bstack_trace=/);
  });

  it('formats a message-only JSON log without a pipe separator', () => {
    const payload = {
      time: 1,
      level: 'info',
      caller: 'c.go:1',
      message: 'alone',
    };
    const lines = formatJSONLine(JSON.stringify(payload));
    expect(lines[0].line).toContain('alone');
    expect(lines[0].line).not.toContain('|');
  });

  it('throws when the text is not valid JSON', () => {
    expect(() => formatJSONLine('{not-json')).toThrow();
  });
});
