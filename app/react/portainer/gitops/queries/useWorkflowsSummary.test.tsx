import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useWorkflowsSummary } from './useWorkflowsSummary';

const summary = {
  healthy: 3,
  error: 1,
  syncing: 0,
  paused: 2,
  unknown: 0,
};

describe('REQ-GIT-01 useWorkflowsSummary', () => {
  it('loads the workflows summary', async () => {
    server.use(
      http.get('/api/gitops/workflows/summary', () =>
        HttpResponse.json(summary)
      )
    );

    const { result } = renderHook(() => useWorkflowsSummary(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(summary);
  });

  it('surfaces API errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/gitops/workflows/summary', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useWorkflowsSummary(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    restore();
  });
});
