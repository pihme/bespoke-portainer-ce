import { describe, it, expect } from 'vitest';

import { ResourceControlType } from '@/react/portainer/access-control/types';

import { ResourceControlOwnershipParameters } from './resourceControlOwnershipParameters';
import { ResourceControlCreatePayload } from './resourceControlCreatePayload';

describe('REQ-USR-08 ResourceControlCreatePayload', () => {
  it('builds a create payload from resource id, type and ownership parameters', () => {
    const ownership = new ResourceControlOwnershipParameters(false, false, [3], [5], ['child-1']);
    const payload = new ResourceControlCreatePayload('container-abc', ResourceControlType.Container, ownership);

    expect(payload.ResourceID).toBe('container-abc');
    expect(payload.Type).toBe(ResourceControlType.Container);
    expect(payload.Public).toBe(false);
    expect(payload.AdministratorsOnly).toBe(false);
    expect(payload.Users).toEqual([3]);
    expect(payload.Teams).toEqual([5]);
    expect(payload.SubResourceIDs).toEqual(['child-1']);
  });

  it('marks administrators-only and public flags from the ownership view data', () => {
    const adminOnly = new ResourceControlCreatePayload(
      'volume-1',
      ResourceControlType.Volume,
      new ResourceControlOwnershipParameters(true, false)
    );
    expect(adminOnly.AdministratorsOnly).toBe(true);
    expect(adminOnly.Public).toBe(false);
    expect(adminOnly.Type).toBe(ResourceControlType.Volume);

    const publicRc = new ResourceControlCreatePayload(
      'network-1',
      ResourceControlType.Network,
      new ResourceControlOwnershipParameters(false, true)
    );
    expect(publicRc.AdministratorsOnly).toBe(false);
    expect(publicRc.Public).toBe(true);
    expect(publicRc.Type).toBe(ResourceControlType.Network);
  });
});
