import { renderHook, act } from '@testing-library/react-hooks';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useDeleteWebhook } from './useDeleteWebhook';

describe('useDeleteWebhook', () => {
  it('deletes a webhook by id', async () => {
    let deleted = '';
    server.use(
      http.delete('/api/webhooks/:id', ({ params }) => {
        deleted = String(params.id);
        return new HttpResponse(null, { status: 204 });
      })
    );
    const { result } = renderHook(() => useDeleteWebhook(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    await act(async () => {
      await result.current.mutateAsync({ webhookId: 9 });
    });
    expect(deleted).toBe('9');
  });

  it('surfaces delete errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.delete('/api/webhooks/:id', () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 })
      )
    );
    const { result } = renderHook(() => useDeleteWebhook(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    await expect(
      result.current.mutateAsync({ webhookId: 9 })
    ).rejects.toThrow();
    restore();
  });
});
