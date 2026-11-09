import { renderHook, act } from '@testing-library/react-hooks';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useUpdateWebhook } from './useUpdateWebhook';

describe('useUpdateWebhook', () => {
  it('updates a webhook registry id', async () => {
    let body: unknown;
    server.use(
      http.put('/api/webhooks/:id', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ Id: 4, Token: 't' });
      })
    );
    const { result } = renderHook(() => useUpdateWebhook(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    await act(async () => {
      await result.current.mutateAsync({ webhookId: 4, registryId: 8 });
    });
    expect(body).toEqual({ registryId: 8 });
  });

  it('defaults registryId and surfaces errors', async () => {
    let body: unknown;
    server.use(
      http.put('/api/webhooks/:id', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ Id: 4, Token: 't' });
      })
    );
    const { result } = renderHook(() => useUpdateWebhook(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    await act(async () => {
      await result.current.mutateAsync({ webhookId: 4 });
    });
    expect(body).toEqual({ registryId: 0 });

    const restore = suppressConsoleLogs();
    server.use(
      http.put('/api/webhooks/:id', () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 })
      )
    );
    await expect(
      result.current.mutateAsync({ webhookId: 4 })
    ).rejects.toThrow();
    restore();
  });
});
