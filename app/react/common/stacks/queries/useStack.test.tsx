import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useStack } from './useStack';

describe('REQ-STK-01 useStack', () => {
  it('loads a stack by id', async () => {
    server.use(
      http.get('/api/stacks/9', () => HttpResponse.json({ Id: 9, Name: 'api' }))
    );
    const { result } = renderHook(() => useStack(9), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ Id: 9, Name: 'api' });
  });

  it('stays disabled without a stack id', async () => {
    const { result } = renderHook(() => useStack(undefined), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
  });

  it('surfaces retrieve errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/stacks/9', () =>
        HttpResponse.json({ message: 'missing' }, { status: 404 })
      )
    );
    const { result } = renderHook(() => useStack(9), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    restore();
  });
});
