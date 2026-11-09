import { describe, expect, it } from 'vitest';

import { SOURCE_TYPES } from './types';

describe('SOURCE_TYPES', () => {
  it('maps git helm and oci source kinds', () => {
    expect(SOURCE_TYPES.git.label).toBe('Git');
    expect(SOURCE_TYPES.helm.label).toBe('Helm');
    expect(SOURCE_TYPES.oci.label).toBe('OCI');
    expect(SOURCE_TYPES.git.icon).toBeTruthy();
  });
});
