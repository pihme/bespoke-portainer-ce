import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useWebhooks } from './useWebhooks';
import { WebhookType } from './types';

const sample = {
  Id: 1,
  Token: 'tok',
  ResourceId: 'abc',
  EndpointId: 3,
  RegistryId: 0,
  Type: WebhookType.DockerContainer,
};

describe('useWebhooks', () => {
  it('loads webhooks for a resource', async () => {
    let filters: string | null = null;
    server.use(
      http.get('/api/webhooks', ({ request }) => {
        filters = new URL(request.url).searchParams.get('filters');
        return HttpResponse.json([sample]);
      })
    );

    const { result } = renderHook(
      () => useWebhooks({ endpointId: 3, resourceId: 'abc' }),
      { wrapper: withTestQueryProvider(({ children }) => <>{children}</>) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sample]);
    expect(filters).toContain('"endpointId":3');
  });

  it('stays idle when disabled and surfaces errors', async () => {
    const { result: disabled } = renderHook(
      () => useWebhooks({ endpointId: 3 }, { enabled: false }),
      { wrapper: withTestQueryProvider(({ children }) => <>{children}</>) }
    );
    expect(disabled.current.fetchStatus).toBe('idle');

    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/webhooks', () =>
        HttpResponse.json({ message: 'fail' }, { status: 500 })
      )
    );
    const { result } = renderHook(
      () => useWebhooks({ endpointId: 3, resourceId: 'abc' }),
      { wrapper: withTestQueryProvider(({ children }) => <>{children}</>) }
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    restore();
  });
});
