import { renderHook, act } from '@testing-library/react-hooks';
import { describe, it, expect, beforeEach } from 'vitest';

import { get, keyBuilder, set, useLocalStorage } from './useLocalStorage';

const KEY = 'local-storage-test';
const STORAGE_KEY = keyBuilder(KEY);

describe('keyBuilder', () => {
  it('prefixes keys with portainer.', () => {
    expect(keyBuilder('ui')).toBe('portainer.ui');
  });
});

describe('get / set', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the default when nothing is stored', () => {
    expect(get(KEY, { a: 1 })).toEqual({ a: 1 });
  });

  it('round-trips JSON values through localStorage', () => {
    set(KEY, { a: 2 });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ a: 2 }));
    expect(get(KEY, { a: 0 })).toEqual({ a: 2 });
  });

  it('returns the default when stored JSON is invalid', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json');
    expect(get(KEY, 'fallback')).toBe('fallback');
  });

  it('honours a custom storage backend', () => {
    const custom = {
      store: new Map<string, string>(),
      getItem(k: string) {
        return this.store.get(k) ?? null;
      },
      setItem(k: string, v: string) {
        this.store.set(k, v);
      },
      removeItem(k: string) {
        this.store.delete(k);
      },
      clear() {
        this.store.clear();
      },
      key() {
        return null;
      },
      get length() {
        return this.store.size;
      },
    } as Storage;

    set(KEY, 7, custom);
    expect(get(KEY, 0, custom)).toBe(7);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the default and persists updates', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, 1));

    expect(result.current[0]).toBe(1);

    act(() => {
      result.current[1](9);
    });

    expect(result.current[0]).toBe(9);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('9');
  });

  it('initialises from an existing stored value', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify('seeded'));

    const { result } = renderHook(() => useLocalStorage(KEY, 'default'));

    expect(result.current[0]).toBe('seeded');
  });
});
