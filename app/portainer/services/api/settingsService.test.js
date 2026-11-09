import { describe, it, expect, vi, beforeEach } from 'vitest';

import { mockQ, promiseResource, rejectResource } from './angularFactoryHelpers.test.js';


const { factoryState, angularMock } = vi.hoisted(() => {
  const factoryState = { factory: null };
  const moduleApi = {
    factory: vi.fn((_name, depsOrFn) => {
      factoryState.factory = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
    service: vi.fn((_name, fn) => {
      factoryState.factory = fn;
      return moduleApi;
    }),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  // Production factories use bare global `angular` (no import).
  globalThis.angular = angularMock;
  return { factoryState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

await import('./settingsService.js');

function buildService(Settings) {
  return factoryState.factory(mockQ(), Settings);
}

describe('REQ-SET-01 SettingsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('settings maps the API payload into SettingsViewModel', async () => {
    const Settings = {
      get: vi.fn(() =>
        promiseResource({
          LogoURL: 'logo',
          SnapshotInterval: '5m',
          TemplatesURL: '',
          EdgeAgentCheckinInterval: 5,
        })
      ),
      update: vi.fn(() => promiseResource({})),
      publicSettings: vi.fn(() =>
        promiseResource({
          EnableEdgeComputeFeatures: true,
          Features: {},
          Edge: {},
        })
      ),
    };
    const service = buildService(Settings);
    const settings = await service.settings();
    expect(settings.LogoURL).toBe('logo');
    expect(settings.SnapshotInterval).toBe('5m');
    expect(Settings.get).toHaveBeenCalled();
  });

  it('settings rejects with a clear message on failure', async () => {
    const Settings = {
      get: vi.fn(() => rejectResource(new Error('nope'))),
    };
    const service = buildService(Settings);
    await expect(service.settings()).rejects.toMatchObject({
      msg: 'Unable to retrieve application settings',
    });
  });

  it('update and publicSettings call the Settings resource', async () => {
    const Settings = {
      get: vi.fn(),
      update: vi.fn(() => promiseResource({ ok: true })),
      publicSettings: vi.fn(() =>
        promiseResource({
          EnableEdgeComputeFeatures: true,
          Features: {},
          Edge: {},
        })
      ),
    };
    const service = buildService(Settings);
    await service.update({ SnapshotInterval: '10m' });
    const pub = await service.publicSettings();
    expect(Settings.update).toHaveBeenCalled();
    expect(pub.EnableEdgeComputeFeatures).toBe(true);
    // REQ-TAI-001: no LDAP connectivity check
    expect(service.checkLDAPConnectivity).toBeUndefined();
  });

  it('publicSettings rejects with a clear message on failure', async () => {
    const Settings = {
      publicSettings: vi.fn(() => rejectResource(new Error('down'))),
    };
    const service = buildService(Settings);
    await expect(service.publicSettings()).rejects.toMatchObject({
      msg: 'Unable to retrieve application settings',
    });
  });
});
