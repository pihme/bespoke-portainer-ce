import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createElement, Fragment } from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';

import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { queryKeys } from './queryKeys';
import { useImages } from './useImages';
import { deleteImage } from './useDeleteImageMutation';
import { pullImage } from './usePullImageMutation';
import { usePruneImagesMutation } from './usePruneImagesMutation';
import {
  buildImageFromDockerfileContent,
  buildImageFromDockerfileContentAndFiles,
  buildImageFromURL,
  buildImageFromUpload,
} from './useBuildImageMutation';

function HookWrapper({ children }: { children: React.ReactNode }) {
  const W = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return createElement(W, null, children);
}

describe('local Docker image queries', () => {
  it('queryKeys list includes withUsage options', () => {
    expect(queryKeys.base(1)).toEqual(expect.arrayContaining(['images']));
    expect(queryKeys.list(1, { withUsage: true })).toEqual(
      expect.arrayContaining([{ withUsage: true }])
    );
  });

  it('useImages loads /api/docker/:id/images', async () => {
    server.use(
      http.get('/api/docker/:id/images', ({ request }) => {
        const withUsage = new URL(request.url).searchParams.get('withUsage');
        expect(withUsage).toBe('true');
        return HttpResponse.json([
          { id: 'sha256:1', created: 1, size: 10, tags: ['nginx:latest'], used: true },
        ]);
      })
    );
    const { result } = renderHook(() => useImages(1, true), {
      wrapper: HookWrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].id).toBe('sha256:1');
  });

  it('useImages surfaces parse errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/docker/:id/images', () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 })
      )
    );
    const { result } = renderHook(() => useImages(1), { wrapper: HookWrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    restore();
  });

  it('deleteImage deletes via docker proxy without an agent header (REQ-TAI-007)', async () => {
    let agent: string | null = null;
    let force: string | null = null;
    server.use(
      http.delete('/api/endpoints/:id/docker/images/:iid', ({ request }) => {
        agent = request.headers.get('X-PortainerAgent-Target');
        force = new URL(request.url).searchParams.get('force');
        return new HttpResponse(null, { status: 204 });
      })
    );
    await deleteImage({
      environmentId: 1,
      imageId: 'sha256:abc',
      nodeName: 'n1',
      force: true,
    });
    expect(agent).toBeNull();
    expect(force).toBe('true');

    const restore = suppressConsoleLogs();
    server.use(
      http.delete('/api/endpoints/:id/docker/images/:iid', () =>
        HttpResponse.json({ message: 'busy' }, { status: 500 })
      )
    );
    await expect(
      deleteImage({ environmentId: 1, imageId: 'x' })
    ).rejects.toThrow(/Unable to delete image|busy/i);
    restore();
  });

  it('pullImage posts fromImage and can ignore errors', async () => {
    let fromImage: string | null = null;
    server.use(
      http.post('/api/endpoints/:id/docker/images/create', ({ request }) => {
        fromImage = new URL(request.url).searchParams.get('fromImage');
        return new HttpResponse('{}', { status: 200 });
      })
    );
    await pullImage({
      environmentId: 2,
      image: 'nginx:latest',
      ignoreErrors: false,
      nodeName: 'worker',
    });
    expect(fromImage).toContain('nginx');

    server.use(
      http.post('/api/endpoints/:id/docker/images/create', () =>
        HttpResponse.json({ message: 'fail' }, { status: 500 })
      )
    );
    await expect(
      pullImage({
        environmentId: 2,
        image: 'bad',
        ignoreErrors: true,
      })
    ).resolves.toBeUndefined();

    const restore = suppressConsoleLogs();
    await expect(
      pullImage({
        environmentId: 2,
        image: 'bad',
        ignoreErrors: false,
      })
    ).rejects.toThrow(/Unable to pull image|fail/i);
    restore();
  });

  it('REQ-TAI-005 pulls by name without an X-Registry-Auth header', async () => {
    let authHeader: string | null = 'unset';
    let fromImage: string | null = '';
    server.use(
      http.post('/api/endpoints/:id/docker/images/create', ({ request }) => {
        authHeader = request.headers.get('X-Registry-Auth');
        fromImage = new URL(request.url).searchParams.get('fromImage');
        return HttpResponse.json({});
      })
    );
    await pullImage({
      environmentId: 2,
      image: 'registry.local/app',
      ignoreErrors: false,
    });
    expect(authHeader).toBeNull();
    expect(fromImage).toBe('registry.local/app:latest');
  });

  it('usePruneImagesMutation prunes images and optional build cache', async () => {
    let imageFilters = '';
    server.use(
      http.post('/api/endpoints/:id/docker/images/prune', ({ request }) => {
        imageFilters = new URL(request.url).searchParams.get('filters') || '';
        return HttpResponse.json({ SpaceReclaimed: 10, ImagesDeleted: [] });
      }),
      http.post('/api/endpoints/:id/docker/build/prune', () =>
        HttpResponse.json({ SpaceReclaimed: 5, CachesDeleted: [] })
      )
    );

    const { result } = renderHook(() => usePruneImagesMutation(4), {
      wrapper: HookWrapper,
    });

    let pruned = await result.current.mutateAsync({ all: false });
    expect(pruned.SpaceReclaimed).toBe(10);
    expect(imageFilters).toContain('dangling');

    pruned = await result.current.mutateAsync({
      all: true,
      clearBuildCache: true,
    });
    expect(pruned.SpaceReclaimed).toBe(15);

    server.use(
      http.post('/api/endpoints/:id/docker/build/prune', () =>
        HttpResponse.json({ message: 'cache fail' }, { status: 500 })
      )
    );
    pruned = await result.current.mutateAsync({
      clearBuildCache: true,
    });
    expect(pruned.SpaceReclaimed).toBe(10);
    expect(pruned.buildCacheError).toBeTruthy();
  });

  it('buildImage helpers post to the docker build proxy', async () => {
    let contentType = '';
    server.use(
      http.post('/api/endpoints/:id/docker/build', ({ request }) => {
        contentType = request.headers.get('Content-Type') || '';
        return HttpResponse.json([{ stream: 'Step 1' }]);
      })
    );

    await buildImageFromDockerfileContent(5, ['app:latest'], 'FROM alpine');
    expect(contentType).toMatch(/application\/json/);

    await buildImageFromURL(5, ['app:1'], 'https://example.com/ctx.tgz', 'Dockerfile');
    expect(contentType).toMatch(/application\/x-tar/);

    await buildImageFromUpload(
      5,
      ['app:2'],
      new File(['FROM alpine'], 'Dockerfile'),
      'Dockerfile'
    );

    await buildImageFromDockerfileContentAndFiles(
      5,
      ['app:3'],
      'FROM alpine',
      [new File(['x'], 'extra.txt')]
    );
    expect(contentType).toMatch(/multipart\/form-data/);

    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/endpoints/:id/docker/build', () =>
        HttpResponse.json({ message: 'build fail' }, { status: 500 })
      )
    );
    await expect(
      buildImageFromDockerfileContent(5, ['x'], 'FROM alpine')
    ).rejects.toThrow(/Unable to build image|build fail/i);
    restore();
  });
});
