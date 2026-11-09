import { renderHook, act } from '@testing-library/react-hooks';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { createWebhook, useCreateWebhook } from './useCreateWebhook';
import { WebhookType } from './types';

describe('useCreateWebhook', () => {
  it('createWebhook posts to /webhooks', async () => {
    let body: unknown;
    server.use(
      http.post('/api/webhooks', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ Id: 2, Token: 't' });
      })
    );
    await createWebhook({
      resourceId: 'abc',
      environmentId: 1,
      webhookType: WebhookType.DockerContainer,
    });
    expect(body).toMatchObject({
      endpointId: 1,
      resourceId: 'abc',
      webhookType: WebhookType.DockerContainer,
    });
  });

  it('mutation succeeds and surfaces errors', async () => {
    server.use(
      http.post('/api/webhooks', () => HttpResponse.json({ Id: 2, Token: 't' }))
    );
    const { result } = renderHook(() => useCreateWebhook(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    await act(async () => {
      await result.current.mutateAsync({
        resourceId: 'abc',
        environmentId: 1,
        webhookType: WebhookType.DockerContainer,
      });
    });

    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/webhooks', () =>
        HttpResponse.json({ message: 'nope' }, { status: 400 })
      )
    );
    await expect(
      result.current.mutateAsync({
        resourceId: 'abc',
        environmentId: 1,
        webhookType: WebhookType.DockerContainer,
      })
    ).rejects.toThrow();
    restore();
  });
});
