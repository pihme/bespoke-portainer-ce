import { describe, it, expect } from 'vitest';

import { ResourceControlOwnershipParameters } from './resourceControlOwnershipParameters';

describe('REQ-USR-08 ResourceControlOwnershipParameters', () => {
  it('defaults to administrators-only false, public false and empty arrays', () => {
    const params = new ResourceControlOwnershipParameters();
    expect(params.AdministratorsOnly).toBe(false);
    expect(params.Public).toBe(false);
    expect(params.Users).toEqual([]);
    expect(params.Teams).toEqual([]);
    expect(params.SubResourceIDs).toEqual([]);
  });

  it('stores admin-only, public, users, teams and sub-resources from args', () => {
    const params = new ResourceControlOwnershipParameters(true, false, [1, 2], [9], ['vol-a']);
    expect(params.AdministratorsOnly).toBe(true);
    expect(params.Public).toBe(false);
    expect(params.Users).toEqual([1, 2]);
    expect(params.Teams).toEqual([9]);
    expect(params.SubResourceIDs).toEqual(['vol-a']);
  });

  it('allows a public ownership with no users or teams', () => {
    const params = new ResourceControlOwnershipParameters(false, true);
    expect(params.AdministratorsOnly).toBe(false);
    expect(params.Public).toBe(true);
    expect(params.Users).toEqual([]);
    expect(params.Teams).toEqual([]);
  });
});
