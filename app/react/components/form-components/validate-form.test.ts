import { describe, expect, it } from 'vitest';
import { object, string } from 'yup';

import { validateForm } from './validate-form';

describe('validateForm', () => {
  const schema = () =>
    object({
      name: string().required('name required'),
    });

  it('returns undefined when values pass', async () => {
    await expect(validateForm(schema, { name: 'ok' })).resolves.toBeUndefined();
  });

  it('returns formik errors when values fail', async () => {
    const errors = await validateForm(schema, { name: '' });
    expect(errors).toEqual({ name: 'name required' });
  });
});
