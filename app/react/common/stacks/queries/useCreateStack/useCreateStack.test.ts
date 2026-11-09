import { createElement, Fragment } from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

import { useCreateStack } from './useCreateStack';

function renderCreateHook() {
  const Wrapper = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return renderHook(() => useCreateStack(), { wrapper: Wrapper });
}

describe('useCreateStack local Compose (standalone)', () => {
  it('creates from string content', async () => {
    server.use(
      http.post('/api/stacks/create/standalone/string', () =>
        HttpResponse.json({
          Id: 1,
          Name: 's',
          ResourceControl: { Id: 50, Type: 1, ResourceId: 's' },
        })
      )
    );

    const { result } = renderCreateHook();
    let stack: unknown;
    await act(async () => {
      stack = await result.current.mutateAsync({
        type: 'standalone',
        method: 'string',
        payload: {
          name: 's',
          environmentId: 1,
          fileContent: 'services: {}',
          fromAppTemplate: false,
          webhook: 'w',
        },
      });
    });

    expect(stack).toMatchObject({ Id: 1 });
  });

  it('creates from uploaded file', async () => {
    server.use(
      http.post('/api/stacks/create/standalone/file', () =>
        HttpResponse.json({
          Id: 2,
          Name: 'f',
          ResourceControl: { Id: 51, Type: 1, ResourceId: 'f' },
        })
      )
    );
    const { result } = renderCreateHook();
    await act(async () => {
      await result.current.mutateAsync({
        type: 'standalone',
        method: 'file',
        payload: {
          name: 'f',
          environmentId: 1,
          file: new File(['x'], 'x.yml'),
        },
      });
    });
  });

  it('creates from git source settings', async () => {
    let body: unknown;
    server.use(
      http.post(
        '/api/stacks/create/standalone/repository',
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({
            Id: 3,
            Name: 'g',
            ResourceControl: { Id: 52, Type: 1, ResourceId: 'g' },
          });
        }
      )
    );
    const { result } = renderCreateHook();
    await act(async () => {
      await result.current.mutateAsync({
        type: 'standalone',
        method: 'git',
        payload: {
          name: 'g',
          environmentId: 2,
          git: {
            SourceId: 9,
            RepositoryReferenceName: 'refs/heads/main',
            ComposeFilePathInRepository: 'docker-compose.yml',
            AdditionalFiles: ['a.yml'],
            AutoUpdate: undefined,
          },
          relativePathSettings: {
            SupportRelativePath: true,
            FilesystemPath: '/data',
          } as never,
          fromAppTemplate: true,
          webhook: 'hook',
        },
      });
    });
    expect(body).toMatchObject({
      name: 'g',
      sourceId: 9,
      composeFile: 'docker-compose.yml',
      additionalFiles: ['a.yml'],
      supportRelativePath: true,
      filesystemPath: '/data',
      fromAppTemplate: true,
    });
  });

  it('REQ-TAI-001 creates without applying any ownership', async () => {
    const resourceControlCalls = vi.fn();
    server.use(
      http.post('/api/stacks/create/standalone/string', () =>
        HttpResponse.json({ Id: 4, Name: 'norc' })
      ),
      http.all('/api/resource_controls*', () => {
        resourceControlCalls();
        return HttpResponse.json(null, { status: 404 });
      })
    );
    const { result } = renderCreateHook();
    let stack: unknown;
    await act(async () => {
      stack = await result.current.mutateAsync({
        type: 'standalone',
        method: 'string',
        payload: {
          name: 'norc',
          environmentId: 1,
          fileContent: 'x',
        },
      });
    });
    expect(stack).toMatchObject({ Id: 4 });
    expect(resourceControlCalls).not.toHaveBeenCalled();
  });

});
