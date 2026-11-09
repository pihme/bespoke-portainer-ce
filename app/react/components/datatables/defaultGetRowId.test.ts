import { describe, expect, it } from 'vitest';

import { defaultGetRowId } from './defaultGetRowId';

describe('defaultGetRowId (backwards compatibility)', () => {
  it('reads a lowercase id string', () => {
    expect(defaultGetRowId({ id: 'vol-1', name: 'data' })).toBe('vol-1');
  });

  it('reads Id before falling through and stringifies numbers', () => {
    expect(defaultGetRowId({ Id: 42 })).toBe('42');
  });

  it('reads ID when id and Id are absent', () => {
    expect(defaultGetRowId({ ID: 'UPPER' })).toBe('UPPER');
  });

  it('returns an empty string when no id-like key exists or the value is not string/number', () => {
    expect(defaultGetRowId({ name: 'x' })).toBe('');
    expect(defaultGetRowId({ id: { nested: true } })).toBe('');
  });
});
