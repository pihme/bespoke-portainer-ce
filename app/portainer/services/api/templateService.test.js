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

await import('./templateService.js');

function minimalTemplate(overrides = {}) {
  return {
    id: 1,
    title: 'Nginx',
    type: 1,
    description: 'web',
    administrator_only: false,
    image: 'nginx:latest',
    registry: '',
    categories: ['web'],
    ...overrides,
  };
}

describe('REQ-TPL-01 TemplateService', () => {
  beforeEach(() => vi.clearAllMocks());

  function build({ templatesPayload, templatesResource = {} } = {}) {
    const Templates = {
      query: vi.fn(() =>
        promiseResource(
          templatesPayload || {
            version: '2',
            templates: [minimalTemplate()],
          }
        )
      ),
      file: vi.fn(() => promiseResource({ FileContent: 'services: {}' })),
      ...templatesResource,
    };
    const service = factoryState.factory(mockQ(), Templates);
    return { service, Templates };
  }

  it('templates maps app templates', async () => {
    const { service } = build();
    const list = await service.templates(3);
    expect(list).toHaveLength(1);
    expect(list[0].Title).toBe('Nginx');
  });

  it('REQ-TAI-005 templates attach no registry object; the registry host is folded into the image name', async () => {
    const { service } = build({
      templatesPayload: {
        version: '2',
        templates: [minimalTemplate({ registry: 'registry.example.com' })],
      },
    });
    const list = await service.templates(1);
    expect(list[0].RegistryModel).not.toHaveProperty('Registry');
    expect(list[0].RegistryModel.Image).toBe('registry.example.com/nginx:latest');
  });

  it('templates supports version 3 template payloads', async () => {
    const { service } = build({
      templatesPayload: {
        version: '3',
        templates: [minimalTemplate({ id: 9, title: 'Redis' })],
      },
    });
    const list = await service.templates(1);
    expect(list[0].Id).toBe(9);
    expect(list[0].Title).toBe('Redis');
  });

  it('templates rejects with a clear message when the query fails', async () => {
    const { service } = build({
      templatesResource: { query: vi.fn(() => rejectResource(new Error('down'))) },
    });
    await expect(service.templates(1)).rejects.toMatchObject({
      msg: 'Unable to retrieve templates',
    });
  });

  it('templates rejects when the template version is unsupported', async () => {
    const { service } = build({
      templatesPayload: { version: '9', templates: [minimalTemplate()] },
    });
    await expect(service.templates(1)).rejects.toMatchObject({
      msg: 'Unable to retrieve templates',
    });
  });

  it('templateFile fetches compose content from a repository path', async () => {
    const { service, Templates } = build();
    await expect(
      service.templateFile('https://example.com/r.git', 'docker-compose.yml')
    ).resolves.toEqual({ FileContent: 'services: {}' });
    expect(Templates.file).toHaveBeenCalledWith({
      repositoryUrl: 'https://example.com/r.git',
      composeFilePathInRepository: 'docker-compose.yml',
    });
  });
});
