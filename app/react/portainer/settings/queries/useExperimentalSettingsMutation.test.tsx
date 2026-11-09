import { renderHook, act } from '@testing-library/react-hooks';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useUpdateExperimentalSettingsMutation } from './useExperimentalSettingsMutation';

describe('useUpdateExperimentalSettingsMutation', () => {
  it('updates experimental settings via PUT', async () => {
    let body: unknown;
    server.use(
      http.put('/api/settings/experimental', async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      })
    );

    const { result } = renderHook(() => useUpdateExperimentalSettingsMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await act(async () => {
      await result.current.mutateAsync({});
    });

    expect(body).toEqual({});
  });

  it('surfaces experimental update errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.put('/api/settings/experimental', () =>
        HttpResponse.json({ message: 'denied' }, { status: 403 })
      )
    );

    const { result } = renderHook(() => useUpdateExperimentalSettingsMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await expect(result.current.mutateAsync({})).rejects.toThrow();
    restore();
  });
});
