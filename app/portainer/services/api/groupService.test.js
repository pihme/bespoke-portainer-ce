import { describe, it, expect, vi, beforeEach } from 'vitest';

import { mockQ, promiseResource } from './angularFactoryHelpers.test.js';


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

await import('./groupService.js');

describe('REQ-ENV-13 GroupService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('group maps EndpointGroupModel and groups lists all', async () => {
    const EndpointGroups = {
      get: vi.fn(() => promiseResource({ Id: 1, Name: 'default', Description: '', TagIds: [] })),
      query: vi.fn(() => promiseResource([{ Id: 1, Name: 'default' }])),
      create: vi.fn(() => promiseResource({ Id: 2 })),
      update: vi.fn(() => promiseResource({ Id: 1 })),
      updateAccess: vi.fn(() => promiseResource({})),
      addEndpoint: vi.fn(() => promiseResource({})),
      removeEndpoint: vi.fn(() => promiseResource({})),
      remove: vi.fn(() => promiseResource({})),
    };
    const service = factoryState.factory(mockQ(), EndpointGroups);
    const group = await service.group(1);
    expect(group.Name).toBe('default');
    await expect(service.groups()).resolves.toEqual([{ Id: 1, Name: 'default' }]);
    await service.deleteGroup(1);
    expect(EndpointGroups.remove).toHaveBeenCalledWith({ id: 1 });
  });

  it('createGroup, updateGroup, access and endpoint membership helpers forward payloads', async () => {
    const EndpointGroups = {
      get: vi.fn(),
      query: vi.fn(),
      create: vi.fn(() => promiseResource({ Id: 2 })),
      update: vi.fn(() => promiseResource({ Id: 1 })),
      updateAccess: vi.fn(() => promiseResource({})),
      addEndpoint: vi.fn(() => promiseResource({})),
      removeEndpoint: vi.fn(() => promiseResource({})),
      remove: vi.fn(),
    };
    const service = factoryState.factory(mockQ(), EndpointGroups);
    await service.createGroup({ Name: 'g', Description: '', TagIds: [] }, [1]);
    await service.updateGroup({ Id: 1, Name: 'g', Description: '', TagIds: [], UserAccessPolicies: {}, TeamAccessPolicies: {} }, [1]);
    await service.updateAccess(1, { 2: { RoleId: 0 } }, {});
    await service.addEndpoint(1, 9);
    await service.removeEndpoint(1, 9);
    expect(EndpointGroups.create).toHaveBeenCalled();
    expect(EndpointGroups.update).toHaveBeenCalled();
    expect(EndpointGroups.updateAccess).toHaveBeenCalledWith(
      { id: 1 },
      { UserAccessPolicies: { 2: { RoleId: 0 } }, TeamAccessPolicies: {} }
    );
    expect(EndpointGroups.addEndpoint).toHaveBeenCalledWith({ id: 1, action: 'endpoints/9' });
    expect(EndpointGroups.removeEndpoint).toHaveBeenCalledWith({ id: 1, action: 'endpoints/9' });
  });
});
