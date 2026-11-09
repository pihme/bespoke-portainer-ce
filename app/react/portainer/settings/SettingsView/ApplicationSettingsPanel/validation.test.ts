import { validation } from './validation';

describe('REQ-SET-01 application settings validation', () => {
  const schema = validation();

  it('requires snapshot interval and accepts empty optional urls', async () => {
    await expect(
      schema.validate({
        edgeAgentCheckinInterval: 5,
        loginBannerEnabled: false,
        loginBanner: '',
        logoEnabled: false,
        logo: '',
        snapshotInterval: '5m',
        templatesUrl: '',
      })
    ).resolves.toBeTruthy();
  });

  it('requires logo url when logo is enabled', async () => {
    await expect(
      schema.validate({
        edgeAgentCheckinInterval: 5,
        loginBannerEnabled: false,
        loginBanner: '',
        logoEnabled: true,
        logo: '',
        snapshotInterval: '5m',
        templatesUrl: '',
      })
    ).rejects.toThrow(/Logo url is required/);
  });

  it('rejects an invalid templates url', async () => {
    await expect(
      schema.validate({
        edgeAgentCheckinInterval: 5,
        loginBannerEnabled: false,
        loginBanner: '',
        logoEnabled: false,
        logo: '',
        snapshotInterval: '5m',
        templatesUrl: 'not-a-url',
      })
    ).rejects.toThrow(/Must be a valid URL/);
  });
});
