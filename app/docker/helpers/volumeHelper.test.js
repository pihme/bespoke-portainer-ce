import { describe, it, expect, vi, beforeEach } from 'vitest';

const { factoryState, angularMock } = vi.hoisted(() => {
  const factoryState = { factory: null };
  const moduleApi = {
    factory: vi.fn((_name, depsOrFn) => {
      factoryState.factory = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { factoryState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

await import('./volumeHelper.js');

function volumeHelper() {
  return factoryState.factory();
}

describe('REQ-VOL-05 VolumeHelper.isVolumeUsedByAService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when a service mounts the volume by Id', () => {
    const helper = volumeHelper();
    const volume = { Id: 'vol-a' };
    const services = [
      { Mounts: [{ Source: 'other' }] },
      { Mounts: [{ Source: 'vol-a' }, { Source: 'vol-b' }] },
    ];
    expect(helper.isVolumeUsedByAService(volume, services)).toBe(true);
  });

  it('returns false when no service mounts the volume', () => {
    const helper = volumeHelper();
    expect(
      helper.isVolumeUsedByAService({ Id: 'vol-a' }, [{ Mounts: [{ Source: 'vol-b' }] }])
    ).toBe(false);
  });

  it('returns false for an empty services list', () => {
    const helper = volumeHelper();
    expect(helper.isVolumeUsedByAService({ Id: 'vol-a' }, [])).toBe(false);
  });
});
