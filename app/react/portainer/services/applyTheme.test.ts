import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyTheme } from './applyTheme';

function stubMatchMedia(media: Partial<MediaQueryList>) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(media),
  });
}

describe('REQ-SET-01 applyTheme', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('theme');
    vi.restoreAllMocks();
  });

  it('sets an explicit theme color', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('theme')).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.getAttribute('theme')).toBe('light');
  });

  it('follows prefers-color-scheme for auto and cleans up listeners', () => {
    const listeners: Array<() => void> = [];
    const media = {
      matches: true,
      addEventListener: vi.fn((_e: string, cb: () => void) => {
        listeners.push(cb);
      }),
      removeEventListener: vi.fn((_e: string, cb: () => void) => {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      }),
    };
    stubMatchMedia(media);

    applyTheme('auto');
    expect(document.documentElement.getAttribute('theme')).toBe('dark');

    media.matches = false;
    listeners[0]?.();
    expect(document.documentElement.getAttribute('theme')).toBeNull();

    applyTheme('dark');
    expect(media.removeEventListener).toHaveBeenCalled();
  });

  it('treats empty color as auto', () => {
    const media = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    stubMatchMedia(media);
    applyTheme('' as never);
    expect(document.documentElement.getAttribute('theme')).toBeNull();
  });
});
