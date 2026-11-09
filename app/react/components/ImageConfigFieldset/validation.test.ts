import { validation } from './validation';

describe('REQ-IMG-02 ImageConfigFieldset validation', () => {
  it('requires an image name', async () => {
    await expect(
      validation().validate({ image: '', registryId: 0, useRegistry: true })
    ).rejects.toThrow(/Image is required/);
  });

  it('accepts a filled image config', async () => {
    await expect(
      validation().validate({
        image: 'nginx:latest',
        registryId: 1,
        useRegistry: true,
      })
    ).resolves.toMatchObject({ image: 'nginx:latest' });
  });
});
