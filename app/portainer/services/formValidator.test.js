import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceControlOwnership as RCO } from '@/react/portainer/access-control/types';

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

await import('./formValidator.js');

describe('REQ-USR-08 FormValidator access control', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validateAccessControl accepts disabled access control', () => {
    const validator = factoryState.factory();
    expect(validator.validateAccessControl({ AccessControlEnabled: false }, true)).toBe('');
  });

  it('validateAccessControl requires users or teams for admin restricted ownership', () => {
    const validator = factoryState.factory();
    expect(
      validator.validateAccessControl(
        { AccessControlEnabled: true, Ownership: RCO.RESTRICTED, AuthorizedUsers: [], AuthorizedTeams: [] },
        true
      )
    ).toBe('You must specify at least one team or user.');
    expect(
      validator.validateAccessControl(
        { AccessControlEnabled: true, Ownership: RCO.RESTRICTED, AuthorizedUsers: [1], AuthorizedTeams: [] },
        true
      )
    ).toBe('');
  });

  it('validateAccessControl requires a team for non-admin restricted ownership', () => {
    const validator = factoryState.factory();
    expect(
      validator.validateAccessControl(
        { AccessControlEnabled: true, Ownership: RCO.RESTRICTED, AuthorizedUsers: [], AuthorizedTeams: [] },
        false
      )
    ).toBe('You must specify at least a team.');
    expect(
      validator.validateAccessControl(
        { AccessControlEnabled: true, Ownership: RCO.RESTRICTED, AuthorizedUsers: [], AuthorizedTeams: [1] },
        false
      )
    ).toBe('');
  });
});
