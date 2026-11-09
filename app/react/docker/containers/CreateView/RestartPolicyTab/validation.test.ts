import { describe, expect, it } from 'vitest';

import { RestartPolicy } from './types';
import { validation } from './validation';

describe('REQ-CTR-03 restart policy validation', () => {
  const schema = validation();

  it('accepts known restart policies', async () => {
    await expect(schema.validate(RestartPolicy.Always)).resolves.toBe(
      RestartPolicy.Always
    );
  });

  it('rejects unknown values', async () => {
    await expect(schema.validate('sometimes')).rejects.toThrow();
  });
});
