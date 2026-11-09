import { describe, expect, it } from 'vitest';

import { validation } from './validation';

describe('REQ-CTR-03 labels validation', () => {
  const schema = validation();

  it('requires a label name', async () => {
    await expect(
      schema.validate([{ name: '', value: 'x' }])
    ).rejects.toThrow(/Name is required/);
  });

  it('accepts named labels', async () => {
    await expect(
      schema.validate([{ name: 'owner', value: 'me' }])
    ).resolves.toEqual([{ name: 'owner', value: 'me' }]);
  });
});
