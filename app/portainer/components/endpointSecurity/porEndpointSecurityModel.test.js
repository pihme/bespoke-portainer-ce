import { describe, expect, it } from 'vitest';

import { EndpointSecurityFormData } from './porEndpointSecurityModel';

describe('EndpointSecurityFormData TLS defaults', () => {
  it('starts with TLS disabled and client+CA mode', () => {
    const data = new EndpointSecurityFormData();
    expect(data.TLS).toBe(false);
    expect(data.TLSMode).toBe('tls_client_ca');
    expect(data.TLSCACert).toBeNull();
    expect(data.TLSCert).toBeNull();
    expect(data.TLSKey).toBeNull();
  });
});
