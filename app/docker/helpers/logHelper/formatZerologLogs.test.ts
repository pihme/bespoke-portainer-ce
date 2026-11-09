import { describe, it, expect } from 'vitest';

import { formatZerologLogs, ZerologRegex } from './formatZerologLogs';
import { Colors, TIMESTAMP_LENGTH } from './types';

const SAMPLE =
  '2022/02/01 04:30AM INF path/to/file.go:12 > listening | port=9000 host=0.0.0.0';

describe('REQ-CTR-10 formatZerologLogs container log formatting', () => {
  it('matches a classic zerolog line with ZerologRegex', () => {
    expect(ZerologRegex.test(SAMPLE)).toBe(true);
    expect(ZerologRegex.test('not a zerolog line')).toBe(false);
  });

  it('formats date, level, caller, message and key=value pairs', () => {
    const lines = formatZerologLogs(SAMPLE);
    expect(lines).toHaveLength(1);
    const { line, spans } = lines[0];
    // Observed: formatters return the full growing line and callers append it,
    // so `line` repeats earlier fragments. Assert spans and key fragments.
    expect(spans.some((s) => s.text === '2022/02/01 04:30AM')).toBe(true);
    expect(spans.some((s) => s.fgColor === Colors.Green && s.text === 'INF')).toBe(
      true
    );
    expect(spans.some((s) => s.text === 'to/file.go:12')).toBe(true);
    expect(spans.some((s) => s.text === 'listening')).toBe(true);
    expect(spans.some((s) => s.text === '|')).toBe(true);
    expect(spans.some((s) => s.text === 'port=')).toBe(true);
    expect(spans.some((s) => s.text === '9000')).toBe(true);
    expect(spans.some((s) => s.text === 'host=')).toBe(true);
    expect(spans.some((s) => s.text === '0.0.0.0')).toBe(true);
    expect(line).toContain('host=0.0.0.0');
  });

  it('parses pairs-only zerolog content when there is no message pipe', () => {
    const raw =
      '2022/02/01 04:30AM ERR pkg/boom.go:3 > error=boom code=500';
    const lines = formatZerologLogs(raw);
    expect(lines).toHaveLength(1);
    expect(lines[0].line).toContain('ERR');
    expect(lines[0].line).toContain('error=boom');
    expect(lines[0].line).toContain('code=500');
    expect(
      lines[0].spans.some((s) => s.fgColor === Colors.Red && s.text === 'boom')
    ).toBe(true);
  });

  it('extracts and formats a stack_trace pair as extra lines', () => {
    const stack = JSON.stringify([
      { func: 'main.Run', line: '10', source: 'main.go' },
    ]);
    const raw = `2022/02/01 04:30AM ERR a.go:1 > failed | stack_trace=${stack} x=1`;
    const lines = formatZerologLogs(raw);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0].line).toContain('failed');
    // stack_trace is removed from pairs; remaining pairs still format
    expect(lines.some((l) => l.line.includes('at main.Run'))).toBe(true);
  });

  it('prefixes the Docker timestamp when withTimestamps is set', () => {
    const ts = '2024-01-02T03:04:05.000000000Z ';
    expect(ts).toHaveLength(TIMESTAMP_LENGTH);
    const lines = formatZerologLogs(`${ts}${SAMPLE}`, true);
    expect(lines).toHaveLength(1);
    expect(lines[0].spans[0]).toEqual({ text: ts });
    expect(lines[0].line.startsWith(ts)).toBe(true);
    expect(lines[0].line).toContain('INF');
  });

  it('formats a zerolog line that has a message and no pairs', () => {
    const raw = '2022/02/01 04:30AM INF a.go:1 > hello world |';
    const lines = formatZerologLogs(raw);
    expect(lines[0].line).toContain('hello world');
  });
});
