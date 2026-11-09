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
  globalThis.angular = angularMock;
  return { factoryState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

await import('./resourceControlService.js');

function build() {
  const ResourceControl = {
    update: vi.fn((_params, payload) => promiseResource({ ok: true, ...payload })),
  };
  const UserService = { users: vi.fn(() => Promise.resolve([{ Id: 1, Username: 'alice' }])) };
  const TeamService = { teams: vi.fn(() => Promise.resolve([{ Id: 2, Name: 'devs' }])) };
  const ResourceControlHelper = {
    RCFormDataToOwnershipParameters: vi.fn(() => ({
      AdministratorsOnly: false,
      Public: true,
      Users: [1],
      Teams: [],
    })),
    RCViewModelToOwnershipParameters: vi.fn(() => ({
      AdministratorsOnly: true,
      Public: false,
      Users: [],
      Teams: [],
    })),
    retrieveAuthorizedUsers: vi.fn((_rc, users) => users),
    retrieveAuthorizedTeams: vi.fn((_rc, teams) => teams),
  };
  const service = factoryState.factory(mockQ(), ResourceControl, UserService, TeamService, ResourceControlHelper);
  return { service, ResourceControl, UserService, TeamService, ResourceControlHelper };
}

describe('REQ-USR-08 ResourceControlService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applyResourceControl updates ownership from form data', async () => {
    const { service, ResourceControl, ResourceControlHelper } = build();
    await service.applyResourceControl(1, { Ownership: 'public' }, { Id: 9 }, [10]);
    expect(ResourceControlHelper.RCFormDataToOwnershipParameters).toHaveBeenCalledWith(
      1,
      { Ownership: 'public' },
      [10]
    );
    expect(ResourceControl.update).toHaveBeenCalledWith(
      { id: 9 },
      expect.objectContaining({ Public: true, Users: [1] })
    );
  });

  it('duplicateResourceControl copies ownership onto a new control', async () => {
    const { service, ResourceControl, ResourceControlHelper } = build();
    await service.duplicateResourceControl(1, { Id: 1 }, { Id: 2 });
    expect(ResourceControlHelper.RCViewModelToOwnershipParameters).toHaveBeenCalled();
    expect(ResourceControl.update).toHaveBeenCalledWith(
      { id: 2 },
      expect.objectContaining({ AdministratorsOnly: true })
    );
  });

  it('retrieveOwnershipDetails resolves empty lists when control is missing', async () => {
    const { service } = build();
    await expect(service.retrieveOwnershipDetails(null)).resolves.toEqual({
      authorizedUsers: [],
      authorizedTeams: [],
    });
  });

  it('retrieveOwnershipDetails loads users and teams when accesses exist', async () => {
    const { service, UserService, TeamService, ResourceControlHelper } = build();
    const rc = {
      UserAccesses: [{ UserId: 1 }],
      TeamAccesses: [{ TeamId: 2 }],
    };
    const details = await service.retrieveOwnershipDetails(rc);
    expect(UserService.users).toHaveBeenCalledWith(false);
    expect(TeamService.teams).toHaveBeenCalled();
    expect(ResourceControlHelper.retrieveAuthorizedUsers).toHaveBeenCalled();
    expect(details.authorizedUsers).toEqual([{ Id: 1, Username: 'alice' }]);
    expect(details.authorizedTeams).toEqual([{ Id: 2, Name: 'devs' }]);
  });

  it('retrieveOwnershipDetails skips user/team fetches when accesses are empty', async () => {
    const { service, UserService, TeamService } = build();
    await service.retrieveOwnershipDetails({ UserAccesses: [], TeamAccesses: [] });
    expect(UserService.users).not.toHaveBeenCalled();
    expect(TeamService.teams).not.toHaveBeenCalled();
  });

  it('retrieveOwnershipDetails rejects with a clear message on failure', async () => {
    const { service, UserService } = build();
    UserService.users.mockRejectedValue(new Error('down'));
    await expect(
      service.retrieveOwnershipDetails({ UserAccesses: [{ UserId: 1 }], TeamAccesses: [] })
    ).rejects.toMatchObject({ msg: 'Unable to retrieve user and team information' });
  });
});
