import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLicenses: vi.fn(),
  attachLicense: vi.fn(),
  removeLicense: vi.fn(),
  getLicenseInfo: vi.fn(),
  unsubscribe: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('@/react/portainer/licenses/license.service', () => mocks);

import { LicenseService } from './license.service';

describe('LicenseService angular factory', () => {
  it('exposes CE-facing license helpers mapped to react service functions', () => {
    const api = LicenseService();
    expect(api).toEqual({
      licenses: mocks.getLicenses,
      attach: mocks.attachLicense,
      remove: mocks.removeLicense,
      info: mocks.getLicenseInfo,
      subscribe: mocks.subscribe,
      unsubscribe: mocks.unsubscribe,
    });
  });
});
