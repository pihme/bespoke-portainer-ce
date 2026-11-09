import { describe, it, expect, vi, beforeEach } from 'vitest';

import { promiseResource, rejectResource } from './angularFactoryHelpers.test.js';

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

await import('./customTemplate.js');

describe('REQ-TPL-03 CustomTemplateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // customTemplates() uses jQuery to strip images from sanitized HTML notes
    globalThis.$ = vi.fn(() => {
      const api = {
        html: vi.fn(function html(arg) {
          if (arg !== undefined) {
            this._html = arg;
            return this;
          }
          return this._html || '';
        }),
        find: vi.fn(() => ({
          remove: vi.fn(() => ({
            end: vi.fn(() => ({
              html: vi.fn(() => 'clean note'),
            })),
          })),
        })),
      };
      return api;
    });
  });

  function build(overrides = {}) {
    const $sanitize = vi.fn((s) => s);
    const CustomTemplates = {
      get: vi.fn(({ id }) => promiseResource({ Id: id, Title: 't' })),
      query: vi.fn(() => promiseResource([{ Id: 1, Title: 'one', Note: '<img src=x>hi' }])),
      remove: vi.fn(() => promiseResource({})),
      file: vi.fn(() => promiseResource({ FileContent: 'compose: "3"' })),
      gitFetch: vi.fn(() => promiseResource({ FileContent: 'from-git' })),
      update: vi.fn(() => promiseResource({ Id: 1 })),
      create: vi.fn((_p, body) => promiseResource({ Id: 3, ...body })),
      ...(overrides.CustomTemplates || {}),
    };
    const FileUploadService = {
      createCustomTemplate: vi.fn(() => Promise.resolve({ data: { Id: 4 } })),
      ...(overrides.FileUploadService || {}),
    };
    return factoryState.factory($sanitize, CustomTemplates, FileUploadService);
  }

  it('customTemplate and remove forward to CustomTemplates', async () => {
    const service = build();
    await expect(service.customTemplate(2)).resolves.toMatchObject({ Id: 2 });
    await service.remove(2);
  });

  it('customTemplates sanitizes notes for compose templates', async () => {
    const service = build();
    const templates = await service.customTemplates(1, false);
    expect(templates[0].Note).toBe('clean note');
  });

  it('customTemplateFile reads local file content and remote git fetch', async () => {
    const service = build();
    await expect(service.customTemplateFile(1, false)).resolves.toBe('compose: "3"');
    await expect(service.customTemplateFile(1, true)).resolves.toBe('from-git');
  });

  it('customTemplateFile wraps failures in PortainerError', async () => {
    const service = build({
      CustomTemplates: { file: vi.fn(() => rejectResource(new Error('missing'))) },
    });
    await expect(service.customTemplateFile(1)).rejects.toThrow(/Unable to retrieve custom template content/);
  });

  it('createCustomTemplateFromFileContent and FileUpload create templates', async () => {
    const service = build();
    await expect(
      service.createCustomTemplateFromFileContent({ Title: 't', FileContent: 'x' })
    ).resolves.toMatchObject({ method: 'string' });
    await expect(service.createCustomTemplateFromFileUpload({ Title: 'u' })).resolves.toEqual({
      Id: 4,
    });
  });

  it('createCustomTemplateFromGitRepository creates from repository method', async () => {
    const service = build();
    await expect(
      service.createCustomTemplateFromGitRepository({ Title: 'g', RepositoryURL: 'https://x' })
    ).resolves.toMatchObject({ method: 'repository' });
  });

  it('updateCustomTemplate forwards the payload', async () => {
    const service = build();
    await service.updateCustomTemplate(1, { Title: 'new' });
  });
});
