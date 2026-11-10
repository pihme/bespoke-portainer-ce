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

await import('./endpointService.js');

function buildService({ endpoints = {}, uploads = {} } = {}) {
  const $q = mockQ();
  const Endpoints = {
    get: vi.fn(({ id }) => promiseResource({ Id: id, Name: 'local' })),
    snapshots: vi.fn(() => promiseResource({})),
    snapshot: vi.fn(({ id }) => promiseResource({ Id: id })),
    updateAccess: vi.fn(() => promiseResource({})),
    disassociate: vi.fn(() => promiseResource({})),
    update: vi.fn((_params, payload) => promiseResource({ Id: 1, ...payload })),
    remove: vi.fn(() => promiseResource({})),
    updateSecuritySettings: vi.fn(() => promiseResource({ AllowBindMountsForRegularUsers: false })),
    updateEndpoint: vi.fn(() => promiseResource({})),
    ...endpoints,
  };
  const FileUploadService = {
    uploadTLSFilesForEndpoint: vi.fn(() => Promise.resolve()),
    ...uploads,
  };
  const service = factoryState.factory($q, Endpoints, FileUploadService);
  return { service, $q, Endpoints, FileUploadService };
}

describe('REQ-ENV-01 EndpointService local Docker client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('REQ-TAI-005 exposes no registry list or registry access calls', () => {
    const { service } = buildService();
    expect(service.registries).toBeUndefined();
    expect(service.updateRegistryAccess).toBeUndefined();
  });

  it('endpoint loads by id', async () => {
    const { service, Endpoints } = buildService();
    await expect(service.endpoint(3)).resolves.toEqual({ Id: 3, Name: 'local' });
    expect(Endpoints.get).toHaveBeenCalledWith({ id: 3 });
  });

  it('snapshotEndpoints and snapshotEndpoint call Endpoints resource', async () => {
    const { service, Endpoints } = buildService();
    await service.snapshotEndpoints();
    await service.snapshotEndpoint(2);
    expect(Endpoints.snapshots).toHaveBeenCalled();
    expect(Endpoints.snapshot).toHaveBeenCalledWith({ id: 2 }, {});
  });

  it('deleteEndpoint removes the environment', async () => {
    const { service, Endpoints } = buildService();
    await service.deleteEndpoint(9);
    expect(Endpoints.remove).toHaveBeenCalledWith({ id: 9 });
  });

  it('REQ-TAI-018 has no create helpers that send a group or tags', () => {
    const { service } = buildService();
    expect(service.createLocalEndpoint).toBeUndefined();
    expect(service.createRemoteEndpoint).toBeUndefined();
  });

  it('updateEndpoint uploads TLS files then updates', async () => {
    const { service, Endpoints, FileUploadService } = buildService();
    const payload = { Name: 'renamed', TLSCACert: 'ca', TLSCert: 'cert', TLSKey: 'key' };
    const result = await service.updateEndpoint(1, payload);
    expect(FileUploadService.uploadTLSFilesForEndpoint).toHaveBeenCalledWith(1, 'ca', 'cert', 'key');
    expect(Endpoints.update).toHaveBeenCalledWith({ id: 1 }, payload);
    expect(result).toMatchObject({ Id: 1, Name: 'renamed' });
  });

  it('updateEndpoint rejects with environment message on failure', async () => {
    const { service } = buildService({
      uploads: { uploadTLSFilesForEndpoint: vi.fn(() => Promise.reject(new Error('tls'))) },
    });
    await expect(service.updateEndpoint(1, {})).rejects.toMatchObject({
      msg: 'Unable to update environment',
    });
  });

  it('updateSecuritySettings and updateAccess forward to Endpoints', async () => {
    const { service, Endpoints } = buildService();
    await service.updateSecuritySettings(1, { AllowBindMountsForRegularUsers: false });
    await service.updateAccess(1, { 2: { RoleId: 0 } }, {});
    expect(Endpoints.updateSecuritySettings).toHaveBeenCalled();
    expect(Endpoints.updateAccess).toHaveBeenCalledWith({ id: 1 }, { UserAccessPolicies: { 2: { RoleId: 0 } }, TeamAccessPolicies: {} });
  });

  it('disassociateEndpoint calls Endpoints.disassociate', async () => {
    const { service, Endpoints } = buildService();
    await service.disassociateEndpoint(4);
    expect(Endpoints.disassociate).toHaveBeenCalledWith({ id: 4 });
  });
});
