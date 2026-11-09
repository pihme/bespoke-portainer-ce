import { describe, expect, it } from 'vitest';

import { MacvlanFormData } from './networkMacvlanFormModel';

describe('MacvlanFormData local network defaults', () => {
  it('starts with local scope and no node selection', () => {
    const data = new MacvlanFormData();
    expect(data.Scope).toBe('local');
    expect(data.SelectedNetworkConfig).toBeNull();
    // REQ-TAI-003: no Swarm node selection state
    expect(data).not.toHaveProperty('DatatableState');
    expect(data.ParentNetworkCard).toBe('');
  });
});
