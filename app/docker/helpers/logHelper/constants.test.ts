import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('REQ-CTR-10 log helper NEW_LINE_BREAKER', () => {
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    vi.resetModules();
  });

  it('uses CRLF when the browser user agent reports Windows', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    });
    const { NEW_LINE_BREAKER } = await import('./constants');
    expect(NEW_LINE_BREAKER).toBe('\r\n');
  });

  it('uses LF when the browser user agent is not Windows', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64)',
      configurable: true,
    });
    const { NEW_LINE_BREAKER } = await import('./constants');
    expect(NEW_LINE_BREAKER).toBe('\n');
  });
});
