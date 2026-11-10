import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from './server';
import { handlers } from './server-handlers';

describe('setup-tests server handlers (backwards compatibility)', () => {
  it('exports a non-empty MSW handler list', () => {
    expect(handlers.length).toBeGreaterThan(10);
  });

  it('REQ-TAI-013 serves no tag or environment group stubs', () => {
    const paths = handlers.map((h) => String(h.info.path));
    expect(paths.filter((p) => /\/api\/(tags|endpoint_groups)/.test(p))).toEqual(
      []
    );
  });

  it('serves status and version', async () => {
    const status = await fetch('/api/system/status');
    expect(status.ok).toBe(true);

    const version = await fetch('/api/system/version');
    expect((await version.json()).ServerVersion).toBe('v2.10.0');
  });

  it('serves license info, nodes and stacks', async () => {
    expect((await (await fetch('/api/licenses/info')).json()).valid).toBe(true);
    expect((await (await fetch('/api/status/nodes')).json()).nodes).toBe(3);
    expect(await (await fetch('/api/stacks')).json()).toEqual([]);
  });

  it('REQ-TAI-005 serves no registry stubs', () => {
    const paths = handlers.map((h) => String(h.info.path));
    expect(paths.filter((p) => /registr|dockerhub/.test(p))).toEqual([]);
  });

  it('allows overriding handlers via server.use', async () => {
    server.use(
      http.get('/api/stacks', () => HttpResponse.json([{ Id: 99, Name: 'x' }]))
    );
    const stacks = await (await fetch('/api/stacks')).json();
    expect(stacks).toEqual([{ Id: 99, Name: 'x' }]);
  });
});

describe('setup-tests server handlers extra arms', () => {
  it('REQ-TAI-001 has no team, membership, role or resource-control stubs', () => {
    const paths = handlers.map(
      (h) => (h.info as { path?: unknown }).path as string
    );
    for (const gone of [
      '/api/teams',
      '/api/team_memberships',
      '/api/teams/:id/memberships',
      '/api/roles',
      '/api/resource_controls/:id',
      '/api/users',
    ]) {
      expect(paths).not.toContain(gone);
    }
  });

  it('REQ-TAI-002 has no Kubernetes, Helm or Omni stubs', () => {
    const paths = handlers.map(
      (h) => (h.info as { path?: unknown }).path as string
    );
    for (const path of paths) {
      expect(String(path)).not.toMatch(/\/api\/kubernetes|helm|\/api\/omni/);
    }
  });

  it('covers remaining local stub GETs', async () => {
    for (const path of [
      '/api/status',
      '/api/system/info',
      '/api/observability/alerting/settings',
      '/observability/alerting/rules',
      '/api/webhooks',
      '/api/policies',
    ]) {
      expect((await fetch(path)).ok).toBe(true);
    }
  });
});
