import { describe, expect, it } from 'vitest';

import { nanNumberSchema } from './yup-schemas';

describe('nanNumberSchema', () => {
  it('accepts finite numbers and rejects NaN with the default message', async () => {
    const schema = nanNumberSchema();
    await expect(schema.validate(12)).resolves.toBe(12);
    await expect(schema.validate(Number.NaN)).rejects.toThrow(
      'Value is required'
    );
  });

  it('uses a custom type-error message when provided', async () => {
    const schema = nanNumberSchema('Port is required');
    await expect(schema.validate(Number.NaN)).rejects.toThrow(
      'Port is required'
    );
  });
});
