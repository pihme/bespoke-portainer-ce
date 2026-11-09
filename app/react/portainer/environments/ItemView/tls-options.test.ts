import { describe, expect, it } from 'vitest';

import { tlsOptions } from './tls-options';

describe('tlsOptions', () => {
  it('exposes the four TLS verification modes', () => {
    expect(tlsOptions).toHaveLength(4);
    expect(tlsOptions.map((o) => o.value)).toEqual([
      'tls_client_ca',
      'tls_client_noca',
      'tls_ca',
      'tls_only',
    ]);
    expect(tlsOptions.every((o) => o.iconType === 'badge' && o.label)).toBe(
      true
    );
  });
});
