import { validation } from './validation';

describe('REQ-IMG-02 ImageConfigFieldset validation', () => {
  it('requires an image name', async () => {
    await expect(validation().validate({ image: '' })).rejects.toThrow(
      /Image is required/
    );
  });

  it('accepts a filled image config', async () => {
    await expect(
      validation().validate({ image: 'nginx:latest' })
    ).resolves.toMatchObject({ image: 'nginx:latest' });
  });
});
