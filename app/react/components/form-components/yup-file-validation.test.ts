import { describe, expect, it } from 'vitest';

import { file, withFileExtension, withFileSize } from './yup-file-validation';

describe('yup-file-validation', () => {
  it('file() returns a mixed schema', async () => {
    await expect(file().validate(undefined)).resolves.toBeUndefined();
  });

  it('withFileSize accepts missing or small files and rejects oversized ones', async () => {
    const schema = withFileSize(file(), 10);
    await expect(schema.validate(undefined)).resolves.toBeUndefined();
    await expect(
      schema.validate(new File(['tiny'], 'a.txt'))
    ).resolves.toBeInstanceOf(File);
    await expect(
      schema.validate(new File(['01234567890123456789'], 'big.txt'))
    ).rejects.toThrow(/too big/i);
  });

  it('withFileExtension accepts missing or allowed extensions and rejects others', async () => {
    const schema = withFileExtension(file(), ['env', 'txt']);
    await expect(schema.validate(undefined)).resolves.toBeUndefined();
    await expect(
      schema.validate(new File(['x'], 'vars.env'))
    ).resolves.toBeInstanceOf(File);
    await expect(
      schema.validate(new File(['x'], 'vars.json'))
    ).rejects.toThrow(/invalid extension/i);
    await expect(
      schema.validate(new File(['x'], 'noext'))
    ).rejects.toThrow(/invalid extension/i);
  });
});
