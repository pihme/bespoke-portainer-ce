import { describe, expect, it } from 'vitest';

import { MacvlanFormData } from './networkMacvlanFormModel';

describe('MacvlanFormData local network defaults', () => {
  it('starts with local scope and empty selection', () => {
    const data = new MacvlanFormData();
    expect(data.Scope).toBe('local');
    expect(data.SelectedNetworkConfig).toBeNull();
    expect(data.DatatableState.selectedItems).toEqual([]);
    expect(data.ParentNetworkCard).toBe('');
  });
});
