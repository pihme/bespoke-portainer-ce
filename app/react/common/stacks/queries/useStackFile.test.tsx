import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { getStackFile, useStackFile } from './useStackFile';

describe('REQ-STK-04 useStackFile', () => {
  it('loads a stack file with version params', async () => {
    let version: string | null = null;
    server.use(
      http.get('/api/stacks/3/file', ({ request }) => {
        version = new URL(request.url).searchParams.get('version');
        return HttpResponse.json({ StackFileContent: 'services: {}' });
      })
    );
    const { result } = renderHook(
      () => useStackFile(3, { version: 2 }, { enabled: true }),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ StackFileContent: 'services: {}' });
    expect(version).toBe('2');
  });

  it('getStackFile surfaces errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/stacks/3/file', () =>
        HttpResponse.json({ message: 'no' }, { status: 500 })
      )
    );
    await expect(getStackFile({ stackId: 3 })).rejects.toThrow();
    restore();
  });
});
