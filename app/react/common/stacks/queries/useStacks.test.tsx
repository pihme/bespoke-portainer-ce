import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { getStacks, useStacks } from './useStacks';

describe('REQ-STK-01 useStacks', () => {
  it('lists stacks', async () => {
    server.use(
      http.get('/api/stacks', () => HttpResponse.json([{ Id: 1, Name: 'web' }]))
    );
    const { result } = renderHook(() => useStacks(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ Id: 1, Name: 'web' }]);
  });

  it('getStacks surfaces errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/stacks', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );
    await expect(getStacks()).rejects.toThrow();
    restore();
  });
});
