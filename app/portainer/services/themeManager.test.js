import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/react/portainer/services/applyTheme', () => ({
  applyTheme: vi.fn(),
}));

const { factoryState, angularMock } = vi.hoisted(() => {
  const factoryState = { factory: null };
  const moduleApi = {
    service: vi.fn((_name, fn) => {
      factoryState.factory = fn;
      return moduleApi;
    }),
    factory: vi.fn(),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { factoryState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

const { applyTheme } = await import('@/react/portainer/services/applyTheme');
await import('./themeManager.js');

describe('REQ-SET-01 ThemeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute('theme');
  });

  it('setTheme and autoTheme delegate to applyTheme; defaultTheme clears attribute', () => {
    const manager = factoryState.factory();
    manager.setTheme('dark');
    expect(applyTheme).toHaveBeenCalledWith('dark');
    manager.autoTheme();
    expect(applyTheme).toHaveBeenCalledWith('auto');
    document.documentElement.setAttribute('theme', 'dark');
    manager.defaultTheme();
    expect(document.documentElement.hasAttribute('theme')).toBe(false);
  });
});
