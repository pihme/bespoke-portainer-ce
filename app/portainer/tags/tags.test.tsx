import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import {
  useCreateTagMutation,
  useTags,
  useTagsForEnvironment,
  tagKeys,
} from './queries';
import { createTag, deleteTag, getTags } from './tags.service';
import type { Tag } from './types';

const wrapper = withTestQueryProvider(({ children }) => <>{children}</>);

const tags: Tag[] = [
  { ID: 1, Name: 'prod', Endpoints: { 1: true, 2: false } },
  { ID: 2, Name: 'dev', Endpoints: { 2: true } },
];

describe('REQ-ENV tags helpers', () => {
  it('exposes tag query keys', () => {
    expect(tagKeys.all).toEqual(['tags']);
    expect(tagKeys.tag(3)).toEqual(['tags', 3]);
  });

  it('lists creates and deletes tags via the service', async () => {
    server.use(
      http.get('/api/tags', () => HttpResponse.json(tags)),
      http.post('/api/tags', async ({ request }) => {
        const body = (await request.json()) as { name: string };
        return HttpResponse.json({
          ID: 9,
          Name: body.name,
          Endpoints: {},
        });
      }),
      http.delete('/api/tags/9', () => HttpResponse.json(null))
    );

    await expect(getTags()).resolves.toEqual(tags);
    await expect(createTag('new')).resolves.toMatchObject({
      ID: 9,
      Name: 'new',
    });
    await expect(deleteTag(9)).resolves.toBeUndefined();
  });

  it('surfaces service errors', async () => {
    server.use(
      http.get('/api/tags', () =>
        HttpResponse.json({ message: 'fail' }, { status: 500 })
      ),
      http.post('/api/tags', () =>
        HttpResponse.json({ message: 'fail' }, { status: 500 })
      ),
      http.delete('/api/tags/1', () =>
        HttpResponse.json({ message: 'fail' }, { status: 500 })
      )
    );
    await expect(getTags()).rejects.toThrow();
    await expect(createTag('x')).rejects.toThrow();
    await expect(deleteTag(1)).rejects.toThrow();
  });

  it('useTags and useTagsForEnvironment filter by endpoint', async () => {
    server.use(http.get('/api/tags', () => HttpResponse.json(tags)));
    const { result } = renderHook(() => useTags(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(tags);

    const env = renderHook(() => useTagsForEnvironment(1), { wrapper });
    await waitFor(() => expect(env.result.current.isLoading).toBe(false));
    expect(env.result.current.tags).toEqual([tags[0]]);
  });

  it('useCreateTagMutation creates a tag', async () => {
    server.use(
      http.get('/api/tags', () => HttpResponse.json([])),
      http.post('/api/tags', async ({ request }) => {
        const body = (await request.json()) as { name: string };
        return HttpResponse.json({
          ID: 4,
          Name: body.name,
          Endpoints: {},
        });
      })
    );
    const { result } = renderHook(() => useCreateTagMutation(), { wrapper });
    await expect(result.current.mutateAsync('blue')).resolves.toMatchObject({
      Name: 'blue',
    });
  });

  it('useTags surfaces query errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/tags', () =>
        HttpResponse.json({ message: 'fail' }, { status: 500 })
      )
    );
    const { result } = renderHook(() => useTags({ enabled: true }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    restore();
  });
});
