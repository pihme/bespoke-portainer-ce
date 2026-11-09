import { describe, it, expect, vi } from 'vitest';

import { ResourceControlOwnership as RCO } from '@/react/portainer/access-control/types';

const { angularMock } = vi.hoisted(() => {
  const moduleApi = {
    service: vi.fn((_name, ctor) => moduleApi),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { angularMock, moduleApi };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

const { default: ResourceControlHelper } = await import('./resourceControlHelper.js');

describe('REQ-USR-08 ResourceControlHelper ownership parameters', () => {
  const helper = new ResourceControlHelper();

  it('RCViewModelToOwnershipParameters returns administrators-only ownership when resourceControl is missing', () => {
    const params = helper.RCViewModelToOwnershipParameters(7, null);
    expect(params.AdministratorsOnly).toBe(true);
    expect(params.Public).toBe(false);
    expect(params.Users).toEqual([]);
    expect(params.Teams).toEqual([]);
  });

  it('RCViewModelToOwnershipParameters maps PUBLIC, PRIVATE, RESTRICTED and admin default', () => {
    expect(helper.RCViewModelToOwnershipParameters(3, { Ownership: RCO.PUBLIC })).toMatchObject({
      AdministratorsOnly: false,
      Public: true,
      Users: [],
      Teams: [],
    });

    expect(helper.RCViewModelToOwnershipParameters(3, { Ownership: RCO.PRIVATE })).toMatchObject({
      AdministratorsOnly: false,
      Public: false,
      Users: [3],
      Teams: [],
    });

    const restricted = helper.RCViewModelToOwnershipParameters(3, {
      Ownership: RCO.RESTRICTED,
      UserAccesses: [{ UserId: 11 }, { UserId: 12 }],
      TeamAccesses: [{ TeamId: 21 }],
    });
    expect(restricted).toMatchObject({
      AdministratorsOnly: false,
      Public: false,
      Users: [11, 12],
      Teams: [21],
    });

    expect(
      helper.RCViewModelToOwnershipParameters(3, { Ownership: RCO.ADMINISTRATORS })
    ).toMatchObject({
      AdministratorsOnly: true,
      Public: false,
      Users: [],
      Teams: [],
    });
  });

  it('RCFormDataToOwnershipParameters forces PUBLIC when access control is disabled', () => {
    const params = helper.RCFormDataToOwnershipParameters(
      5,
      {
        AccessControlEnabled: false,
        Ownership: RCO.PRIVATE,
        AuthorizedUsers: [],
        AuthorizedTeams: [],
      },
      ['vol-a']
    );
    expect(params.Public).toBe(true);
    expect(params.AdministratorsOnly).toBe(false);
    expect(params.Users).toEqual([]);
    expect(params.SubResourceIDs).toEqual(['vol-a']);
  });

  it('RCFormDataToOwnershipParameters maps PRIVATE, RESTRICTED and admin form ownership', () => {
    expect(
      helper.RCFormDataToOwnershipParameters(9, {
        AccessControlEnabled: true,
        Ownership: RCO.PRIVATE,
        AuthorizedUsers: [],
        AuthorizedTeams: [],
      })
    ).toMatchObject({ Users: [9], Public: false, AdministratorsOnly: false });

    expect(
      helper.RCFormDataToOwnershipParameters(9, {
        AccessControlEnabled: true,
        Ownership: RCO.RESTRICTED,
        AuthorizedUsers: [{ Id: 1 }, { Id: 2 }],
        AuthorizedTeams: [{ Id: 8 }],
      })
    ).toMatchObject({ Users: [1, 2], Teams: [8] });

    expect(
      helper.RCFormDataToOwnershipParameters(9, {
        AccessControlEnabled: true,
        Ownership: RCO.ADMINISTRATORS,
        AuthorizedUsers: [],
        AuthorizedTeams: [],
      })
    ).toMatchObject({ AdministratorsOnly: true, Public: false });
  });

  it('retrieveAuthorizedUsers and retrieveAuthorizedTeams resolve matching entities', () => {
    const resourceControl = {
      UserAccesses: [{ UserId: 1 }, { UserId: 99 }],
      TeamAccesses: [{ TeamId: 4 }, { TeamId: 5 }],
    };
    const users = [
      { Id: 1, Username: 'alice' },
      { Id: 2, Username: 'bob' },
    ];
    const teams = [
      { Id: 4, Name: 'ops' },
      { Id: 7, Name: 'dev' },
    ];

    expect(helper.retrieveAuthorizedUsers(resourceControl, users)).toEqual([
      { Id: 1, Username: 'alice' },
    ]);
    expect(helper.retrieveAuthorizedTeams(resourceControl, teams)).toEqual([{ Id: 4, Name: 'ops' }]);
  });
});
