import { afterEach, describe, expect, it } from 'vitest';

import { terminalClose, terminalResize } from './terminal-window';

describe('terminal-window helpers (backwards compatibility)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('terminalClose resets page wrapper height and overflow', () => {
    document.body.innerHTML = '<div id="pageWrapper-wrapper"></div>';
    const el = document.getElementById('pageWrapper-wrapper') as HTMLElement;
    terminalClose();
    expect(el.style.height).toBe('100%');
    expect(el.style.overflowY).toBe('initial');
  });

  it('terminalResize shrinks the page wrapper for the terminal', () => {
    document.body.innerHTML = '<div id="pageWrapper-wrapper"></div>';
    const el = document.getElementById('pageWrapper-wrapper') as HTMLElement;
    Object.defineProperty(window, 'innerHeight', { value: 995, configurable: true });
    terminalResize();
    expect(el.style.height).toBe('500px');
    expect(el.style.overflowY).toBe('auto');
  });

  it('does nothing when the page wrapper is missing', () => {
    expect(() => terminalClose()).not.toThrow();
    expect(() => terminalResize()).not.toThrow();
  });
});
