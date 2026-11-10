import { beforeEach, describe, expect, it, vi } from 'vitest';

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

await import('./fileUpload.js');

function buildService(Upload = {}, $q = { all: vi.fn((q) => Promise.all(q)) }) {
  Upload.upload = Upload.upload || vi.fn(() => Promise.resolve({ data: 'ok' }));
  Upload.json = Upload.json || ((v) => JSON.stringify(v));
  return factoryState.factory($q, Upload);
}

describe('REQ-STK-02 FileUploadService compose and TLS', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createComposeStack uploads a standalone compose file', async () => {
    const Upload = { upload: vi.fn(() => Promise.resolve({})), json: (v) => v };
    const service = buildService(Upload);
    await service.createComposeStack('web', { name: 'f' }, [{ name: 'A', value: '1' }], 3, 'hook');
    expect(Upload.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'api/stacks/create/standalone/file?endpointId=3',
        data: expect.objectContaining({ Name: 'web', Webhook: 'hook' }),
        ignoreLoadingBar: true,
      })
    );
  });

  it('uploadTLSFilesForEndpoint queues CA/cert/key uploads for a local endpoint', async () => {
    const Upload = { upload: vi.fn(() => Promise.resolve({})), json: (v) => v };
    const $q = { all: vi.fn((q) => Promise.all(q)) };
    const service = buildService(Upload, $q);
    await service.uploadTLSFilesForEndpoint(5, 'ca', 'cert', 'key');
    expect($q.all).toHaveBeenCalled();
    expect(Upload.upload).toHaveBeenCalledTimes(3);
    expect(Upload.upload).toHaveBeenCalledWith(expect.objectContaining({ url: 'api/upload/tls/ca?folder=5' }));
  });

  it('REQ-TAI-018 has no environment create or LDAP TLS upload helpers', () => {
    const service = buildService();
    expect(service.createEndpoint).toBeUndefined();
    expect(service.uploadLDAPTLSFiles).toBeUndefined();
  });

  it('createCustomTemplate uploads a template file', async () => {
    const Upload = { upload: vi.fn(() => Promise.resolve({})), json: (v) => v };
    const service = buildService(Upload);
    await service.createCustomTemplate({ file: 'f', Title: 't' });
    expect(Upload.upload).toHaveBeenCalledWith(expect.objectContaining({ url: 'api/custom_templates/create/file' }));
  });
});
