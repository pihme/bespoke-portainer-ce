import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Phase C coverage for KEEP local-Docker Angular $resource factories under
 * app/portainer/rest. Deferred: user/team, registries, backup/restore, gitlab, auth.
 */

function installAngularCapture() {
  const factories = {};
  const moduleApi = {
    factory: vi.fn((name, depsOrFn) => {
      factories[name] = Array.isArray(depsOrFn)
        ? depsOrFn[depsOrFn.length - 1]
        : depsOrFn;
      return moduleApi;
    }),
  };
  const angularMock = {
    module: vi.fn(() => moduleApi),
    fromJson: (data) => JSON.parse(data),
  };
  globalThis.angular = angularMock;
  return { factories, angularMock };
}

function mockResource() {
  const calls = [];
  const $resource = vi.fn((url, params, actions) => {
    calls.push({ url, params, actions });
    return { url, params, actions };
  });
  return { $resource, calls };
}

describe('REQ-ENV / REQ-STK / REQ-TPL local Docker REST factories', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('Endpoints wires query transform and local environment actions', async () => {
    const { factories } = installAngularCapture();
    vi.doMock('angular', () => ({
      default: globalThis.angular,
      module: globalThis.angular.module,
    }));
    await import('./endpoint.js');
    const { $resource, calls } = mockResource();
    factories.Endpoints($resource, '/api/endpoints');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/endpoints/:id/:action');
    expect(calls[0].actions.query.method).toBe('GET');
    expect(typeof calls[0].actions.query.transformResponse).toBe('function');
    expect(calls[0].actions.get).toMatchObject({ method: 'GET' });
    expect(calls[0].actions.update).toMatchObject({ method: 'PUT' });
    expect(calls[0].actions.remove).toMatchObject({ method: 'DELETE' });
    expect(calls[0].actions.snapshots).toMatchObject({ method: 'POST' });
    expect(calls[0].actions.snapshot).toMatchObject({ method: 'POST' });
    expect(calls[0].actions.status).toMatchObject({ method: 'GET' });
    expect(calls[0].actions.updateSecuritySettings).toMatchObject({
      method: 'PUT',
    });
  });

  it('Stack exposes compose lifecycle actions and REQ-TAI-002 no StackByName', async () => {
    const { factories } = installAngularCapture();
    vi.doMock('angular', () => ({
      default: globalThis.angular,
      module: globalThis.angular.module,
    }));
    await import('./stack.js');
    const { $resource, calls } = mockResource();
    factories.Stack($resource, '/api/stacks');

    expect(calls[0].url).toBe('/api/stacks/:id/:action/:subaction');
    expect(calls[0].actions.create.method).toBe('POST');
    expect(calls[0].actions.start.method).toBe('POST');
    expect(calls[0].actions.stop.method).toBe('POST');
    expect(calls[0].actions.getStackFile.method).toBe('GET');
    expect(calls[0].actions.updateGit.method).toBe('PUT');
    // REQ-TAI-002: the Kubernetes delete-by-name resource is gone.
    expect(factories.StackByName).toBeUndefined();
  });

  it('CustomTemplates exposes create/query/file/gitFetch', async () => {
    const { factories } = installAngularCapture();
    vi.doMock('angular', () => ({
      default: globalThis.angular,
      module: globalThis.angular.module,
    }));
    await import('./customTemplate.js');
    const { $resource, calls } = mockResource();
    factories.CustomTemplates($resource, '/api/custom_templates');
    expect(calls[0].actions.create.method).toBe('POST');
    expect(calls[0].actions.file.params).toMatchObject({ action: 'file' });
    expect(calls[0].actions.gitFetch.params).toMatchObject({
      action: 'git_fetch',
    });
  });

  it('Settings, SSL, Templates, Support and Webhooks wire local actions', async () => {
    const { factories } = installAngularCapture();
    vi.doMock('angular', () => ({
      default: globalThis.angular,
      module: globalThis.angular.module,
    }));

    await import('./settings.js');
    await import('./ssl.js');
    await import('./template.js');
    await import('./support.js');
    await import('./webhooks.js');

    const { $resource, calls } = mockResource();

    factories.Settings($resource, '/api/settings');
    factories.SSL($resource);
    factories.Templates($resource, '/api/templates');
    factories.Support($resource, '/api/support');
    factories.Webhooks($resource, '/api/webhooks');

    expect(calls.map((c) => c.url)).toEqual([
      '/api/settings/:subResource/:action',
      'api/ssl',
      '/api/templates/:action',
      '/api/support',
      '/api/webhooks/:id',
    ]);
    expect(calls[0].actions.publicSettings.params).toMatchObject({
      subResource: 'public',
    });
    expect(calls[1].actions.upload.method).toBe('PUT');
    expect(calls[2].actions.file.params).toMatchObject({ action: 'file' });
    expect(calls[3].actions.get.isArray).toBe(true);
    expect(calls[4].actions.query.isArray).toBe(true);
    // REQ-TAI-001: no ResourceControl factory
    expect(factories.ResourceControl).toBeUndefined();
    // REQ-TAI-013: no Tags or EndpointGroups factories
    expect(factories.Tags).toBeUndefined();
    expect(factories.EndpointGroups).toBeUndefined();
  });
});
