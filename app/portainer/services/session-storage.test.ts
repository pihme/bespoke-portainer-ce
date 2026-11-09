import { afterEach, describe, expect, it } from 'vitest';

import { clear, get, save } from './session-storage';

describe('session-storage helpers (backwards compatibility)', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('save and get round-trip JSON values', () => {
    save('k', { a: 1 });
    expect(get('k')).toEqual({ a: 1 });
  });

  it('get returns null for missing keys and undefined for invalid JSON', () => {
    // JSON.parse(null) yields null; invalid JSON hits the catch and returns undefined.
    expect(get('missing')).toBeNull();
    sessionStorage.setItem('bad', '{not-json');
    expect(get('bad')).toBeUndefined();
  });

  it('clear empties sessionStorage', () => {
    save('k', 1);
    clear();
    expect(sessionStorage.length).toBe(0);
  });
});
