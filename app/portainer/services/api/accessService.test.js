import { describe, it, expect, vi, beforeEach } from 'vitest';

import { mockQ } from './angularFactoryHelpers.test.js';

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

await import('./accessService.js');

function build(overrides = {}) {
  const $async = (fn, ...args) => Promise.resolve(fn(...args));
  const UserService = {
    users: vi.fn(() =>
      Promise.resolve([
        { Id: 1, Username: 'alice' },
        { Id: 2, Username: 'bob' },
      ])
    ),
    ...(overrides.UserService || {}),
  };
  const TeamService = {
    teams: vi.fn(() => Promise.resolve([{ Id: 10, Name: 'devs' }])),
    ...(overrides.TeamService || {}),
  };
  return factoryState.factory(mockQ(), $async, UserService, TeamService);
}

describe('REQ-ENV-03 AccessService environment access policies', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generateAccessPolicies merges selected users and teams', () => {
    const service = build();
    const policies = service.generateAccessPolicies(
      { 1: { RoleId: 0 } },
      {},
      [{ Id: 2, Role: { Id: 3 } }],
      [{ Id: 10, Role: { Id: 1 } }],
      5
    );
    expect(policies.userAccessPolicies[1]).toEqual({ RoleId: 0 });
    expect(policies.userAccessPolicies[2]).toEqual({ RoleId: 5 });
    expect(policies.teamAccessPolicies[10]).toEqual({ RoleId: 5 });
  });

  it('generateAccessPolicies falls back to access role when selectedRoleId is omitted', () => {
    const service = build();
    const policies = service.generateAccessPolicies({}, {}, [{ Id: 2, Role: { Id: 7 } }], [], undefined);
    expect(policies.userAccessPolicies[2]).toEqual({ RoleId: 7 });
  });

  it('accesses maps authorized, inherited and available users/teams', async () => {
    const service = build();
    const data = await service.accesses(
      {
        UserAccessPolicies: { 1: { RoleId: 0 } },
        TeamAccessPolicies: {},
      },
      {
        UserAccessPolicies: { 2: { RoleId: 0 } },
        TeamAccessPolicies: { 10: { RoleId: 0 } },
      }
    );
    const authorizedIds = data.authorizedUsersAndTeams.map((a) => a.Id).sort((a, b) => a - b);
    const availableIds = data.availableUsersAndTeams.map((a) => a.Id).sort((a, b) => a - b);
    expect(authorizedIds).toEqual([1, 2, 10]);
    expect(availableIds).toEqual([2, 10]);
    expect(data.authorizedUsersAndTeams.find((a) => a.Id === 2).Inherited).toBe(true);
  });

  it('accesses initializes missing policy maps and rejects without entity', async () => {
    const service = build();
    await expect(service.accesses(null)).rejects.toThrow('Unable to retrieve accesses');
    const data = await service.accesses({}, null);
    expect(data.availableUsersAndTeams.length).toBeGreaterThan(0);
  });

  it('accesses rejects with a clear message when users fail to load', async () => {
    const service = build({
      UserService: { users: vi.fn(() => Promise.reject(new Error('down'))) },
    });
    await expect(service.accesses({ UserAccessPolicies: {}, TeamAccessPolicies: {} })).rejects.toMatchObject({
      msg: 'Unable to retrieve users and teams',
    });
  });
});
