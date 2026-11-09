import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { buildCreateUrl } from './buildUrl';
import { createStandaloneStackFromFile } from './createStandaloneStackFromFile';
import { createStandaloneStackFromFileContent } from './createStandaloneStackFromFileContent';
import { createStandaloneStackFromGit } from './createStandaloneStackFromGit';

const stackResponse = {
  Id: 11,
  Name: 'web',
  ResourceControl: { Id: 99, Type: 1, ResourceId: 'web' },
};

describe('buildCreateUrl for local Compose stacks', () => {
  it('builds create URLs for standalone string/file/repository methods', () => {
    expect(buildCreateUrl('standalone', 'string')).toBe(
      '/stacks/create/standalone/string'
    );
    expect(buildCreateUrl('standalone', 'file')).toBe(
      '/stacks/create/standalone/file'
    );
    expect(buildCreateUrl('standalone', 'repository')).toBe(
      '/stacks/create/standalone/repository'
    );
  });
});

describe('REQ create standalone Compose stacks', () => {
  it('createStandaloneStackFromFileContent posts editor content', async () => {
    let body: unknown;
    let endpointId: string | null = null;
    server.use(
      http.post('/api/stacks/create/standalone/string', async ({ request }) => {
        body = await request.json();
        endpointId = new URL(request.url).searchParams.get('endpointId');
        return HttpResponse.json(stackResponse);
      })
    );

    await expect(
      createStandaloneStackFromFileContent({
        name: 'web',
        stackFileContent: 'services:\n  web:\n    image: nginx\n',
        environmentId: 7,
        env: [{ name: 'A', value: '1' }],
        fromAppTemplate: true,
        webhook: 'wh-1',
        registries: [3],
      })
    ).resolves.toMatchObject({ Id: 11, Name: 'web' });

    expect(endpointId).toBe('7');
    expect(body).toMatchObject({
      name: 'web',
      stackFileContent: expect.stringContaining('nginx'),
      fromAppTemplate: true,
      webhook: 'wh-1',
      registries: [3],
    });
  });

  it('createStandaloneStackFromFile uploads multipart form data', async () => {
    let contentType = '';
    let endpointId: string | null = null;
    server.use(
      http.post('/api/stacks/create/standalone/file', async ({ request }) => {
        contentType = request.headers.get('Content-Type') || '';
        endpointId = new URL(request.url).searchParams.get('endpointId');
        return HttpResponse.json(stackResponse);
      })
    );

    const file = new File(['services: {}'], 'compose.yml', {
      type: 'text/yaml',
    });
    await expect(
      createStandaloneStackFromFile({
        Name: 'upload',
        file,
        environmentId: 8,
        Env: [{ name: 'B', value: '2' }],
        Webhook: 'wh-2',
      })
    ).resolves.toMatchObject({ Id: 11 });
    expect(endpointId).toBe('8');
    expect(contentType).toMatch(/multipart\/form-data/i);
  });

  it('createStandaloneStackFromGit posts repository create payload', async () => {
    let body: unknown;
    server.use(
      http.post(
        '/api/stacks/create/standalone/repository',
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json(stackResponse);
        }
      )
    );

    await expect(
      createStandaloneStackFromGit({
        name: 'git-stack',
        environmentId: 9,
        sourceId: 4,
        composeFile: 'docker-compose.yml',
        repositoryReferenceName: 'refs/heads/main',
        additionalFiles: ['env.yml'],
        supportRelativePath: true,
        filesystemPath: '/data',
      })
    ).resolves.toMatchObject({ Id: 11 });
    expect(body).toMatchObject({
      name: 'git-stack',
      sourceId: 4,
      composeFile: 'docker-compose.yml',
      additionalFiles: ['env.yml'],
      supportRelativePath: true,
      filesystemPath: '/data',
    });
  });

  it('standalone creators surface parsed axios errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/stacks/create/standalone/:method', () =>
        HttpResponse.json({ message: 'create failed' }, { status: 500 })
      )
    );
    await expect(
      createStandaloneStackFromFileContent({
        name: 'x',
        stackFileContent: 'x',
        environmentId: 1,
      })
    ).rejects.toBeTruthy();
    await expect(
      createStandaloneStackFromFile({
        Name: 'x',
        file: new File(['x'], 'x.yml'),
        environmentId: 1,
      })
    ).rejects.toBeTruthy();
    await expect(
      createStandaloneStackFromGit({
        name: 'x',
        environmentId: 1,
        sourceId: 1,
      })
    ).rejects.toBeTruthy();
    restore();
  });
});

