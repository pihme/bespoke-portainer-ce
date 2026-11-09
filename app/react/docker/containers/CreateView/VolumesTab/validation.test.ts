import { describe, expect, it } from 'vitest';

import { validation } from './validation';

describe('REQ-CTR-09 volumes validation for create form', () => {
  const schema = validation();

  it('accepts a complete volume row', async () => {
    await expect(
      schema.validate([
        {
          type: 'volume',
          name: 'data',
          containerPath: '/data',
          readOnly: false,
        },
      ])
    ).resolves.toHaveLength(1);
  });

  it('rejects missing container path and volume name', async () => {
    await expect(
      schema.validate([
        {
          type: 'volume',
          name: '',
          containerPath: '',
          readOnly: false,
        },
      ])
    ).rejects.toThrow(/required/i);
  });
});
