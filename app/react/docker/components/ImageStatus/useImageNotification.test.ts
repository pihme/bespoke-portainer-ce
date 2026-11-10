import { createElement, Fragment } from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

import { ResourceType } from './types';
import { useImageNotification } from './useImageNotification';

function renderStatusHook(
  ...args: Parameters<typeof useImageNotification>
) {
  const Wrapper = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return renderHook(() => useImageNotification(...args), { wrapper: Wrapper });
}

describe('useImageNotification for local Docker containers', () => {
  it('fetches container image status without an agent target header (REQ-TAI-007)', async () => {
    let agent: string | null = null;
    server.use(
      http.get('/api/docker/:id/containers/:cid/image_status', ({ request }) => {
        agent = request.headers.get('X-PortainerAgent-Target');
        return HttpResponse.json({ Status: 'updated', Message: 'ok' });
      })
    );

    const { result } = renderStatusHook(1, 'c1', ResourceType.CONTAINER, 'node-a', true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ Status: 'updated', Message: 'ok' });
    expect(agent).toBeNull();
  });

  it('returns unknown status when the container status request fails', async () => {
    server.use(
      http.get('/api/docker/:id/containers/:cid/image_status', () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 })
      )
    );
    const { result } = renderStatusHook(1, 'c2', ResourceType.CONTAINER, '', true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      Status: 'unknown',
      Message: expect.stringContaining('c2'),
    });
  });

  it('stays idle while disabled', async () => {
    const { result } = renderStatusHook(1, 'c3', ResourceType.CONTAINER, '', false);
    expect(result.current.fetchStatus).toBe('idle');
  });
});
