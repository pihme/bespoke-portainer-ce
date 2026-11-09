import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PortainerEndpointCreationTypes } from '@/portainer/models/endpoint/models';

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
    updateRegistryAccess: vi.fn(() => promiseResource({})),
    registries: vi.fn(() => promiseResource([])),
    updateEndpoint: vi.fn(() => promiseResource({})),
    ...endpoints,
  };
  const FileUploadService = {
    uploadTLSFilesForEndpoint: vi.fn(() => Promise.resolve()),
    createEndpoint: vi.fn(() => Promise.resolve({ data: { Id: 7, Name: 'local' } })),
    createAzureEndpoint: vi.fn(() => Promise.resolve({ data: { Id: 8 } })),
    ...uploads,
  };
  const service = factoryState.factory($q, Endpoints, FileUploadService);
  return { service, $q, Endpoints, FileUploadService };
}

describe('REQ-ENV-01 EndpointService local Docker client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('createLocalEndpoint prefixes unix socket paths', async () => {
    const { service, FileUploadService } = buildService();
    const created = await service.createLocalEndpoint('local', '/var/run/docker.sock', '', 1, [2]);
    expect(created).toEqual({ Id: 7, Name: 'local' });
    expect(FileUploadService.createEndpoint).toHaveBeenCalledWith(
      'local',
      PortainerEndpointCreationTypes.LocalDockerEnvironment,
      'unix:///var/run/docker.sock',
      '',
      1,
      [2],
      false
    );
  });

  it('createLocalEndpoint prefixes Windows named pipes', async () => {
    const { service, FileUploadService } = buildService();
    await service.createLocalEndpoint('local', '//./pipe/docker_engine');
    expect(FileUploadService.createEndpoint).toHaveBeenCalledWith(
      'local',
      PortainerEndpointCreationTypes.LocalDockerEnvironment,
      'npipe:////./pipe/docker_engine',
      '',
      1,
      [],
      false
    );
  });

  it('createLocalEndpoint rejects with a clear message on failure', async () => {
    const { service } = buildService({
      uploads: { createEndpoint: vi.fn(() => Promise.reject(new Error('boom'))) },
    });
    await expect(service.createLocalEndpoint('local')).rejects.toMatchObject({
      msg: 'Unable to create environment',
    });
  });

  it('createRemoteEndpoint prefixes tcp for non-edge types', async () => {
    const { service, FileUploadService } = buildService();
    await service.createRemoteEndpoint(
      'remote',
      PortainerEndpointCreationTypes.LocalDockerEnvironment,
      'host:2375',
      'pub',
      1,
      [],
      false,
      false,
      false
    );
    expect(FileUploadService.createEndpoint.mock.calls[0][2]).toBe('tcp://host:2375');
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
    expect(Endpoints.updateAccess).toHaveBeenCalledWith(
      { id: 1 },
      { UserAccessPolicies: { 2: { RoleId: 0 } }, TeamAccessPolicies: {} }
    );
  });

  it('disassociateEndpoint calls Endpoints.disassociate', async () => {
    const { service, Endpoints } = buildService();
    await service.disassociateEndpoint(4);
    expect(Endpoints.disassociate).toHaveBeenCalledWith({ id: 4 });
  });
});
