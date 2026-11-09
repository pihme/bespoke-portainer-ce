import { describe, it, expect } from 'vitest';

import { WebhookViewModel } from './webhook';

describe('REQ-STK-09 WebhookViewModel mapping', () => {
  it('maps webhook id, token, resource, endpoint and type from API fields', () => {
    const vm = new WebhookViewModel({
      Id: 44,
      Token: 'tok-abc',
      ResourceID: 'stack-7',
      EndpointID: 1,
      WebhookType: 1,
    });

    expect(vm.Id).toBe(44);
    expect(vm.Token).toBe('tok-abc');
    expect(vm.ResourceId).toBe('stack-7');
    expect(vm.EndpointId).toBe(1);
    expect(vm.WebhookType).toBe(1);
  });
});
