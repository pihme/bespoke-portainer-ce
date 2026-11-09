import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sidebarStore } from './sidebarStore';

const storageKey = 'portainer.toolbar_toggle';

describe('sidebarStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.ddExtension = false;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1200,
    });
    sidebarStore.setState({ isOpen: true });
  });

  it('toggle flips isOpen and persists to localStorage', () => {
    expect(sidebarStore.getState().isOpen).toBe(true);

    sidebarStore.getState().toggle();
    expect(sidebarStore.getState().isOpen).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(storageKey)!)).toBe(false);

    sidebarStore.getState().toggle();
    expect(sidebarStore.getState().isOpen).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(storageKey)!)).toBe(true);
  });

  it('setOpen updates isOpen without touching localStorage', () => {
    window.localStorage.setItem(storageKey, JSON.stringify(true));
    sidebarStore.getState().setOpen(false);
    expect(sidebarStore.getState().isOpen).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(storageKey)!)).toBe(true);
  });

  it('initializes closed on mobile width', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 500,
    });
    vi.resetModules();
    const { sidebarStore: fresh } = await import('./sidebarStore');
    expect(fresh.getState().isOpen).toBe(false);
  });

  it('initializes closed for ddExtension', async () => {
    window.ddExtension = true;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1400,
    });
    vi.resetModules();
    const { sidebarStore: fresh } = await import('./sidebarStore');
    expect(fresh.getState().isOpen).toBe(false);
  });
});
