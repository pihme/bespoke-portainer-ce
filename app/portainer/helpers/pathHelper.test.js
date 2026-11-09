import { describe, it, expect, afterEach } from 'vitest';

import { baseHref } from './pathHelper.js';

describe('pathHelper baseHref', () => {
  afterEach(() => {
    document.getElementById('base')?.remove();
  });

  it('returns the href attribute of the #base element when present', () => {
    const base = document.createElement('base');
    base.id = 'base';
    base.setAttribute('href', '/portainer/');
    document.head.appendChild(base);

    expect(baseHref()).toBe('/portainer/');
  });

  it('defaults to / when #base exists but href is empty', () => {
    const base = document.createElement('base');
    base.id = 'base';
    base.setAttribute('href', '');
    document.head.appendChild(base);

    expect(baseHref()).toBe('/');
  });

  it('defaults to / when #base is missing', () => {
    expect(document.getElementById('base')).toBeNull();
    expect(baseHref()).toBe('/');
  });
});
