import { describe, it, expect } from 'vitest';

import { PortainerEndpointConnectionTypes } from './models';
import { PortainerEndpointInitFormValues } from './formValues';

describe('REQ-ENV-11 PortainerEndpointInitFormValues defaults', () => {
  it('initializes empty TLS and Azure fields with the documented default connection type', () => {
    const form = new PortainerEndpointInitFormValues();

    expect(form.ConnectionType).toBe(PortainerEndpointConnectionTypes.KUBERNETES_LOCAL);
    expect(form.Name).toBe('');
    expect(form.URL).toBe('');
    expect(form.TLS).toBe(false);
    expect(form.TLSSkipVerify).toBe(false);
    expect(form.TLSSKipClientVerify).toBe(false);
    expect(form.TLSCACert).toBeNull();
    expect(form.TLSCert).toBeNull();
    expect(form.TLSKey).toBeNull();
    expect(form.AzureApplicationId).toBe('');
    expect(form.AzureTenantId).toBe('');
    expect(form.AzureAuthenticationKey).toBe('');
  });

  it('keeps DOCKER_LOCAL assignable for a local Docker init path', () => {
    const form = new PortainerEndpointInitFormValues();
    form.ConnectionType = PortainerEndpointConnectionTypes.DOCKER_LOCAL;
    form.Name = 'local';
    form.URL = 'unix:///var/run/docker.sock';

    expect(form.ConnectionType).toBe(1);
    expect(form.Name).toBe('local');
    expect(form.URL).toBe('unix:///var/run/docker.sock');
  });
});
