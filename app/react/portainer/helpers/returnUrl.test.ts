import { afterEach, describe, expect, it } from 'vitest';

import { keyBuilder } from '@/react/hooks/useLocalStorage';

import { cleanReturnUrl, getReturnUrl, storeReturnUrl } from './returnUrl';

describe('returnUrl helpers', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('stores and reads a return URL via portainer-prefixed localStorage', () => {
    expect(getReturnUrl()).toBeNull();

    storeReturnUrl('/#!/home');

    expect(getReturnUrl()).toBe('/#!/home');
    expect(localStorage.getItem(keyBuilder('RETURN_URL'))).toBe(
      JSON.stringify('/#!/home')
    );
  });

  it('clears the stored return URL', () => {
    storeReturnUrl('/#!/docker/dashboard');
    expect(getReturnUrl()).toBe('/#!/docker/dashboard');

    cleanReturnUrl();

    expect(getReturnUrl()).toBeNull();
    expect(localStorage.getItem(keyBuilder('RETURN_URL'))).toBeNull();
  });
});
