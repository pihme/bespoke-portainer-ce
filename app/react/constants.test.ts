import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('react constants', () => {
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

  it('detects Windows from the browser user agent', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    });
    const mod = await import('./constants');
    expect(mod.BROWSER_OS_PLATFORM).toBe('win');
    expect(mod.STACK_NAME_VALIDATION_REGEX).toBe('^[-_a-z0-9]+$');
    expect(mod.COMPOSE_STACK_NAME_LABEL).toBe('com.docker.compose.project');
    expect(mod.SWARM_STACK_NAME_LABEL).toBe('com.docker.stack.namespace');
  });

  it('detects macOS from the browser user agent', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      configurable: true,
    });
    const mod = await import('./constants');
    expect(mod.BROWSER_OS_PLATFORM).toBe('mac');
  });

  it('falls back to Linux for other user agents', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64)',
      configurable: true,
    });
    const mod = await import('./constants');
    expect(mod.BROWSER_OS_PLATFORM).toBe('lin');
  });
});
