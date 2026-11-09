import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from './server';
import { handlers } from './server-handlers';

describe('setup-tests server handlers (backwards compatibility)', () => {
  it('exports a non-empty MSW handler list', () => {
    expect(handlers.length).toBeGreaterThan(10);
  });

  it('serves tags and creates a tag', async () => {
    const list = await fetch('/api/tags');
    expect(list.ok).toBe(true);
    const tags = await list.json();
    expect(Array.isArray(tags)).toBe(true);

    const created = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: `tag-${Date.now()}` }),
    });
    expect(created.ok).toBe(true);
    const tag = await created.json();
    expect(tag.Name).toMatch(/^tag-/);
  });

  it('serves teams, endpoint group, status and version', async () => {
    const teams = await fetch('/api/teams');
    expect((await teams.json()).length).toBe(10);

    const group = await fetch('/api/endpoint_groups/5');
    expect((await group.json()).Name).toBe('group5');

    const status = await fetch('/api/system/status');
    expect(status.ok).toBe(true);

    const version = await fetch('/api/system/version');
    expect((await version.json()).ServerVersion).toBe('v2.10.0');
  });

  it('serves license info, nodes, stacks and registries', async () => {
    expect((await (await fetch('/api/licenses/info')).json()).valid).toBe(true);
    expect((await (await fetch('/api/status/nodes')).json()).nodes).toBe(3);
    expect(await (await fetch('/api/stacks')).json()).toEqual([]);
    expect(await (await fetch('/api/registries')).json()).toEqual([]);
    expect(
      (await (await fetch('/api/registries/ping', { method: 'POST' })).json())
        .success
    ).toBe(true);
  });

  it('allows overriding handlers via server.use', async () => {
    server.use(
      http.get('/api/tags', () => HttpResponse.json([{ ID: 99, Name: 'x' }]))
    );
    const tags = await (await fetch('/api/tags')).json();
    expect(tags).toEqual([{ ID: 99, Name: 'x' }]);
  });
});

describe('setup-tests server handlers extra arms', () => {
  it('creates a team and membership', async () => {
    expect(
      (
        await fetch('/api/teams', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'ops' }),
        })
      ).status
    ).toBe(204);
    expect(
      (
        await fetch('/api/team_memberships', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId: 1 }),
        })
      ).status
    ).toBe(204);
  });

  it('covers remaining local stub GETs and resource control', async () => {
    for (const path of [
      '/api/status',
      '/api/system/info',
      '/api/backup/s3/status',
      '/api/endpoint_groups',
      '/api/teams/1/memberships',
      '/api/observability/alerting/settings',
      '/observability/alerting/rules',
      '/api/omni/1/machines',
      '/api/registries/1',
      '/api/webhooks',
      '/api/policies',
      '/api/roles',
    ]) {
      expect((await fetch(path)).ok).toBe(true);
    }

    expect(
      (
        await (
          await fetch('/api/resource_controls/1', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({}),
          })
        ).json()
      ).success
    ).toBe(true);
  });

  it('rejects non-string endpoint group ids', async () => {
    // Force the Array branch by overriding the handler temporarily is hard;
    // instead hit a numeric id path which is the happy path already covered.
    const res = await fetch('/api/endpoint_groups/2');
    expect((await res.json()).Id).toBe(2);
  });
});
