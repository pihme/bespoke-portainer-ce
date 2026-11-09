import { describe, expect, it } from 'vitest';

import { isValidUrl } from './validate-url';

describe('isValidUrl', () => {
  it('returns false for empty or undefined', () => {
    expect(isValidUrl(undefined)).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });

  it('returns true for a valid absolute URL', () => {
    expect(isValidUrl('https://example.com/path')).toBe(true);
  });

  it('returns false for an invalid URL string', () => {
    expect(isValidUrl('not a url')).toBe(false);
  });

  it('applies an additional check when provided', () => {
    expect(
      isValidUrl('http://insecure.example', (url) => url.protocol === 'https:')
    ).toBe(false);
    expect(
      isValidUrl('https://secure.example', (url) => url.protocol === 'https:')
    ).toBe(true);
  });
});
