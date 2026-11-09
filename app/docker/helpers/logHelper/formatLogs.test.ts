import { describe, it, expect } from 'vitest';

import { formatLogs } from './formatLogs';
import { TIMESTAMP_LENGTH } from './types';

describe('REQ-CTR-10 formatLogs container log formatting', () => {
  it('splits plain multi-line container logs into formatted lines', () => {
    const lines = formatLogs('hello\nworld');
    expect(lines.map((l) => l.line)).toEqual(['hello', 'world']);
    expect(lines[0].spans).toEqual([
      {
        fgColor: undefined,
        bgColor: undefined,
        text: 'hello',
        fontWeight: undefined,
      },
    ]);
  });

  it('applies ANSI foreground, background, bold and reset styles', () => {
    const lines = formatLogs(
      '\u001b[31mred\u001b[0m \u001b[1mbold\u001b[22m \u001b[44mbg\u001b[49m'
    );
    expect(lines).toHaveLength(1);
    const texts = lines[0].spans.map((s) => s.text);
    expect(texts.join('')).toBe('red bold bg');
    const red = lines[0].spans.find((s) => s.text === 'red');
    expect(red?.fgColor).toMatch(/^rgb\(/);
    const bold = lines[0].spans.find((s) => s.text === 'bold');
    expect(bold?.fontWeight).toBe('bold');
    const bg = lines[0].spans.find((s) => s.text === 'bg');
    expect(bg?.bgColor).toMatch(/^rgb\(/);
  });

  it('resolves 256-color and truecolor ANSI foreground sequences', () => {
    const lines256 = formatLogs('\u001b[38;5;196mhot\u001b[0m');
    expect(lines256[0].spans[0].text).toBe('hot');
    expect(lines256[0].spans[0].fgColor).toMatch(/^rgb\(/);

    const linesTrue = formatLogs('\u001b[38;2;10;20;30mx\u001b[0m');
    expect(linesTrue[0].spans[0].fgColor).toBe('rgb(10, 20, 30)');
  });

  it('resolves 256-color and truecolor ANSI background sequences', () => {
    const lines256 = formatLogs('\u001b[48;5;21mcool\u001b[0m');
    expect(lines256[0].spans[0].text).toBe('cool');
    expect(lines256[0].spans[0].bgColor).toMatch(/^rgb\(/);

    const linesTrue = formatLogs('\u001b[48;2;1;2;3mz\u001b[0m');
    expect(linesTrue[0].spans[0].bgColor).toBe('rgb(1, 2, 3)');
  });

  it('clears colors on fgDefault and bgDefault', () => {
    const lines = formatLogs(
      '\u001b[31mred\u001b[39mdef\u001b[44mbg\u001b[49mplain'
    );
    const defSpan = lines[0].spans.find((s) => s.text === 'def');
    expect(defSpan?.fgColor).toBeUndefined();
    const plain = lines[0].spans.find((s) => s.text === 'plain');
    expect(plain?.bgColor).toBeUndefined();
  });

  it('strips Docker multiplex headers when stripHeaders is set', () => {
    // 8-byte header then payload; a second header after a newline is removed.
    const frame1 = `\x01\x00\x00\x00\x00\x00\x00\x05line1`;
    const frame2 = `\x01\x00\x00\x00\x00\x00\x00\x05line2`;
    const raw = `${frame1}\n${frame2}`;
    const lines = formatLogs(raw, { stripHeaders: true });
    expect(lines.map((l) => l.line)).toEqual(['line1', 'line2']);
  });

  it('unwraps double-serialized JSON log strings', () => {
    const inner = 'plain from json string';
    const lines = formatLogs(JSON.stringify(inner));
    expect(lines.map((l) => l.line)).toEqual([inner]);
  });

  it('keeps a leading quote when the string is not valid JSON', () => {
    const lines = formatLogs('"not-closed');
    expect(lines[0].line).toBe('"not-closed');
  });

  it('formats JSON object log lines via formatJSONLine', () => {
    const payload = {
      time: 1700000000,
      level: 'info',
      caller: 'main.go:1',
      message: 'up',
      id: 7,
    };
    const lines = formatLogs(JSON.stringify(payload));
    expect(lines[0].line).toContain('INF');
    expect(lines[0].line).toContain('up');
    expect(lines[0].line).toContain('id=7');
  });

  it('formats JSON object log lines that start after a Docker timestamp', () => {
    const ts = '2024-01-02T03:04:05.000000000Z ';
    expect(ts).toHaveLength(TIMESTAMP_LENGTH);
    const payload = {
      time: 1700000000,
      level: 'error',
      caller: 'main.go:1',
      message: 'down',
    };
    const lines = formatLogs(`${ts}${JSON.stringify(payload)}`, {
      withTimestamps: true,
    });
    expect(lines[0].spans[0]).toEqual({ text: ts });
    expect(lines[0].line).toContain('ERR');
    expect(lines[0].line).toContain('down');
  });

  it('formats zerolog lines and zerolog lines with a Docker timestamp', () => {
    const zerolog =
      '2022/02/01 04:30AM INF path/to/file.go:12 > listening | port=9000';
    const lines = formatLogs(zerolog);
    expect(lines[0].line).toContain('INF');
    expect(lines[0].line).toContain('listening');
    expect(lines[0].line).toContain('port=9000');

    const ts = '2024-01-02T03:04:05.000000000Z ';
    const withTs = formatLogs(`${ts}${zerolog}`, { withTimestamps: true });
    expect(withTs[0].spans[0]).toEqual({ text: ts });
    expect(withTs[0].line).toContain('INF');
  });

  it('falls back to raw text when JSON parsing inside a line fails', () => {
    // Starts with '{' so the JSON branch is taken, then formatJSONLine throws.
    const lines = formatLogs('{not-valid-json');
    expect(lines[0].line).toBe('{not-valid-json');
    expect(lines[0].spans[0].text).toBe('{not-valid-json');
  });

  it('uses a custom splitter when provided', () => {
    const lines = formatLogs('a|b|c', { splitter: '|' });
    expect(lines.map((l) => l.line)).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array for empty input', () => {
    expect(formatLogs('')).toEqual([]);
  });

  it('returns an empty fgColor for an out-of-range 256-color index', () => {
    // colorMode 5 with a colorRef outside the 256-color table → ''
    const lines = formatLogs('\u001b[38;5;999mx\u001b[0m');
    expect(lines[0].spans[0].text).toBe('x');
    expect(lines[0].spans[0].fgColor).toBe('');
  });
});
