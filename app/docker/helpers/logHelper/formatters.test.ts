import { describe, it, expect } from 'vitest';

import {
  formatCaller,
  formatKeyValuePair,
  formatLevel,
  formatMessage,
  formatStackTrace,
  formatTime,
} from './formatters';
import { Colors, Span, FormattedLine } from './types';

describe('REQ-CTR-10 log helper formatters', () => {
  it('formatTime formats millisecond unix timestamps as a grey date span', () => {
    const spans: Span[] = [];
    // 1700000000000 ms ≈ 2023-11-14
    const line = formatTime(1700000000000, spans, '');
    expect(line).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}(AM|PM) $/);
    expect(spans).toHaveLength(2);
    expect(spans[0]).toMatchObject({ fgColor: Colors.Grey, text: line.trim() });
    expect(spans[1]).toEqual({ text: ' ' });
  });

  it('formatTime treats values at or below 253402214400 as seconds', () => {
    const spans: Span[] = [];
    const line = formatTime(1700000000, spans, '');
    expect(line).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}(AM|PM) $/);
    expect(spans[0].text).toBe(line.trim());
  });

  it('formatTime treats values above 253402214400 as milliseconds', () => {
    const spansSeconds: Span[] = [];
    const spansMs: Span[] = [];
    // Same wall-clock instant expressed as seconds vs milliseconds.
    const asSeconds = 1700000000;
    const asMs = 1700000000000;
    const lineSeconds = formatTime(asSeconds, spansSeconds, '');
    const lineMs = formatTime(asMs, spansMs, '');
    expect(lineSeconds).toBe(lineMs);
  });

  it('formatTime appends a string time unchanged', () => {
    const spans: Span[] = [];
    const line = formatTime('2022/02/01 04:30AM', spans, 'prefix ');
    expect(line).toBe('prefix 2022/02/01 04:30AM ');
    expect(spans[0]).toMatchObject({
      fgColor: Colors.Grey,
      text: '2022/02/01 04:30AM',
    });
  });

  it('formatTime leaves line and spans unchanged when time is missing', () => {
    const spans: Span[] = [];
    expect(formatTime(undefined, spans, 'keep')).toBe('keep');
    expect(spans).toEqual([]);
  });

  it.each([
    ['debug', 'DBG', Colors.Grey],
    ['DBG', 'DBG', Colors.Grey],
    ['info', 'INF', Colors.Green],
    ['INF', 'INF', Colors.Green],
    ['warn', 'WRN', Colors.Yellow],
    ['WRN', 'WRN', Colors.Yellow],
    ['error', 'ERR', Colors.Red],
    ['ERR', 'ERR', Colors.Red],
  ] as const)(
    'formatLevel maps %s to a bold %s span',
    (level, text, color) => {
      const spans: Span[] = [];
      const line = formatLevel(level, spans, '');
      expect(line).toBe(`${text} `);
      expect(spans[0]).toEqual({
        fgColor: color,
        text,
        fontWeight: 'bold',
      });
      expect(spans[1]).toEqual({ text: ' ' });
    }
  );

  it('formatLevel falls back to the raw level text for unknown values', () => {
    const spans: Span[] = [];
    const line = formatLevel('TRACE' as never, spans, '');
    expect(line).toBe('TRACE ');
    expect(spans[0]).toEqual({ text: 'TRACE' });
  });

  it('formatLevel leaves line unchanged when level is missing', () => {
    const spans: Span[] = [];
    expect(formatLevel(undefined, spans, 'x')).toBe('x');
    expect(spans).toEqual([]);
  });

  it('formatCaller keeps the last two path segments and adds a blue chevron', () => {
    const spans: Span[] = [];
    const line = formatCaller('github.com/portainer/api/http/handler.go:42', spans, '');
    expect(line).toBe('http/handler.go:42 > ');
    expect(spans[0]).toEqual({
      fgColor: Colors.Magenta,
      text: 'http/handler.go:42',
      fontWeight: 'bold',
    });
    expect(spans[2]).toEqual({ fgColor: Colors.Blue, text: '>' });
  });

  it('formatCaller leaves line unchanged when caller is missing', () => {
    const spans: Span[] = [];
    expect(formatCaller(undefined, spans, 'x')).toBe('x');
    expect(spans).toEqual([]);
  });

  it('formatMessage appends a magenta message without a pipe when there are no keys', () => {
    const spans: Span[] = [];
    const line = formatMessage('started', spans, '', false);
    expect(line).toBe('started ');
    expect(spans).toHaveLength(2);
    expect(spans[0]).toEqual({ fgColor: Colors.Magenta, text: 'started' });
  });

  it('formatMessage adds a magenta pipe separator when keys follow', () => {
    const spans: Span[] = [];
    const line = formatMessage('started', spans, '', true);
    expect(line).toBe('started | ');
    expect(spans.map((s) => s.text)).toEqual(['started', ' ', '|', ' ']);
  });

  it('formatMessage leaves line unchanged for an empty message', () => {
    const spans: Span[] = [];
    expect(formatMessage('', spans, 'x', false)).toBe('x');
    expect(spans).toEqual([]);
  });

  it('formatKeyValuePair stringifies non-string values and spaces non-final pairs', () => {
    const spans: Span[] = [];
    const line = formatKeyValuePair('count', 3, spans, '', false);
    expect(line).toBe('count=3 ');
    expect(spans[0]).toEqual({ fgColor: Colors.Blue, text: 'count=' });
    expect(spans[1]).toEqual({ fgColor: Colors.Magenta, text: '3' });
    expect(spans[2]).toEqual({ text: ' ' });
  });

  it('formatKeyValuePair colors error and ERR values red and omits trailing space on the last key', () => {
    const spans: Span[] = [];
    const line = formatKeyValuePair('error', 'boom', spans, '', true);
    expect(line).toBe('error=boom');
    expect(spans[1]).toEqual({ fgColor: Colors.Red, text: 'boom' });
    expect(spans).toHaveLength(2);

    const spansErr: Span[] = [];
    formatKeyValuePair('ERR', 'fail', spansErr, '', true);
    expect(spansErr[1]).toEqual({ fgColor: Colors.Red, text: 'fail' });
  });

  it('formatStackTrace appends indented stack frames', () => {
    const lines: FormattedLine[] = [];
    formatStackTrace(
      [
        { func: 'main.Run', line: '10', source: 'main.go' },
        { func: 'runtime.goexit', line: '1', source: 'runtime.go' },
      ],
      lines
    );
    expect(lines).toHaveLength(2);
    expect(lines[0].line).toBe('    at main.Run (main.go:10)');
    expect(lines[0].spans.map((s) => s.text)).toEqual([
      ' ',
      ' ',
      ' ',
      ' ',
      'at ',
      'main.Run',
      '(main.go:10)',
    ]);
    expect(lines[1].line).toBe('    at runtime.goexit (runtime.go:1)');
  });

  it('formatStackTrace is a no-op when stackTrace is missing', () => {
    const lines: FormattedLine[] = [];
    formatStackTrace(undefined, lines);
    expect(lines).toEqual([]);
  });
});
