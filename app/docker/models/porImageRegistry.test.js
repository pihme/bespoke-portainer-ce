import { describe, it, expect } from 'vitest';

import { PorImageRegistryModel } from './porImageRegistry';

describe('REQ-IMG-02 PorImageRegistryModel', () => {
  it('REQ-TAI-005 defaults to a free-form image name with no registry', () => {
    const model = new PorImageRegistryModel();

    expect(model).not.toHaveProperty('UseRegistry');
    expect(model).not.toHaveProperty('Registry');
    expect(model.Image).toBe('');
  });
});
