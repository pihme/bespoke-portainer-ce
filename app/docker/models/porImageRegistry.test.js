import { describe, it, expect } from 'vitest';

import { PorImageRegistryModel } from './porImageRegistry';

describe('REQ-IMG-02 PorImageRegistryModel', () => {
  it('defaults to registry mode with an empty image name for pull forms', () => {
    const model = new PorImageRegistryModel();

    expect(model.UseRegistry).toBe(true);
    expect(model.Registry).toEqual({});
    expect(model.Image).toBe('');
  });
});
