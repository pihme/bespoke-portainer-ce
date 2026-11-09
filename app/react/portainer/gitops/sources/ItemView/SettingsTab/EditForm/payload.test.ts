import { buildUpdatePayload } from './payload';
import { SettingsFormValues } from './types';

const baseValues: SettingsFormValues = {
  name: 'my-source',
  url: 'https://github.com/org/repo.git',
  tlsSkipVerify: false,
  authEnabled: false,
  username: '',
  password: '',
  pollingEnabled: false,
  interval: '',
};

describe('buildUpdatePayload interval handling', () => {
  it('omits interval when polling settings are unchanged', () => {
    const payload = buildUpdatePayload(baseValues, baseValues);
    expect(payload.interval).toBeUndefined();
  });

  it('sends the interval when polling is newly enabled', () => {
    const values: SettingsFormValues = {
      ...baseValues,
      pollingEnabled: true,
      interval: '5m',
    };
    const payload = buildUpdatePayload(values, baseValues);
    expect(payload.interval).toBe('5m');
  });

  it('sends an empty interval when polling is disabled', () => {
    const initialValues: SettingsFormValues = {
      ...baseValues,
      pollingEnabled: true,
      interval: '5m',
    };
    const values: SettingsFormValues = {
      ...initialValues,
      pollingEnabled: false,
    };
    const payload = buildUpdatePayload(values, initialValues);
    expect(payload.interval).toBe('');
  });

  it('sends the updated interval when the value changes while enabled', () => {
    const initialValues: SettingsFormValues = {
      ...baseValues,
      pollingEnabled: true,
      interval: '5m',
    };
    const values: SettingsFormValues = { ...initialValues, interval: '10m' };
    const payload = buildUpdatePayload(values, initialValues);
    expect(payload.interval).toBe('10m');
  });
});

describe('buildUpdatePayload authentication handling', () => {
  it('omits authentication when auth stays disabled', () => {
    const payload = buildUpdatePayload(baseValues, baseValues);
    expect(payload.authentication).toBeUndefined();
  });

  it('clears authentication when auth is disabled after being enabled', () => {
    const initialValues: SettingsFormValues = {
      ...baseValues,
      authEnabled: true,
      username: 'gituser',
    };
    const values: SettingsFormValues = {
      ...initialValues,
      authEnabled: false,
    };
    const payload = buildUpdatePayload(values, initialValues);
    expect(payload.authentication).toEqual({});
  });

  it('sends username and password when auth credentials change', () => {
    const initialValues: SettingsFormValues = {
      ...baseValues,
      authEnabled: true,
      username: 'old',
      password: '',
    };
    const values: SettingsFormValues = {
      ...initialValues,
      username: 'new-user',
      password: 'secret',
    };
    const payload = buildUpdatePayload(values, initialValues);
    expect(payload.authentication).toEqual({
      username: 'new-user',
      password: 'secret',
    });
  });

  it('omits authentication payload when enabled auth fields are unchanged', () => {
    const initialValues: SettingsFormValues = {
      ...baseValues,
      authEnabled: true,
      username: 'gituser',
      password: '',
    };
    const payload = buildUpdatePayload(initialValues, initialValues);
    expect(payload.authentication).toBeUndefined();
  });

  it('includes name url and tls when they change', () => {
    const values: SettingsFormValues = {
      ...baseValues,
      name: 'renamed',
      url: 'https://example.com/r.git',
      tlsSkipVerify: true,
    };
    const payload = buildUpdatePayload(values, baseValues);
    expect(payload.name).toBe('renamed');
    expect(payload.url).toBe('https://example.com/r.git');
    expect(payload.tlsSkipVerify).toBe(true);
  });
});
