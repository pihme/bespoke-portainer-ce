import { describe, it, expect } from 'vitest';

import {
  colors,
  FOREGROUND_COLORS_BY_ANSI,
  BACKGROUND_COLORS_BY_ANSI,
} from './colors';

describe('REQ-CTR-10 log helper ANSI color tables', () => {
  it('builds 256 RGB entries from the raw xterm palette', () => {
    expect(colors).toHaveLength(256);
    expect(colors[0]).toEqual([0, 0, 0]);
    expect(colors[15]).toEqual([255, 255, 255]);
    for (const rgb of colors) {
      expect(rgb).toHaveLength(3);
      for (const channel of rgb) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    }
  });

  it('maps the sixteen ANSI foreground names onto the palette', () => {
    expect(FOREGROUND_COLORS_BY_ANSI.black).toEqual(colors[0]);
    expect(FOREGROUND_COLORS_BY_ANSI.red).toEqual(colors[1]);
    expect(FOREGROUND_COLORS_BY_ANSI.brightWhite).toEqual(colors[15]);
    expect(Object.keys(FOREGROUND_COLORS_BY_ANSI)).toHaveLength(16);
  });

  it('maps the sixteen ANSI background names onto the palette', () => {
    expect(BACKGROUND_COLORS_BY_ANSI.bgBlack).toEqual(colors[0]);
    expect(BACKGROUND_COLORS_BY_ANSI.bgBlue).toEqual(colors[4]);
    expect(BACKGROUND_COLORS_BY_ANSI.bgBrightWhite).toEqual(colors[15]);
    expect(Object.keys(BACKGROUND_COLORS_BY_ANSI)).toHaveLength(16);
  });
});
