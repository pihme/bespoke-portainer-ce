import { waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import { http, HttpResponse } from 'msw';
import { createElement, Fragment } from 'react';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useDashboard } from './useDashboard';

const dashboardPayload = {
  containers: {
    total: 5,
    running: 3,
    stopped: 2,
    healthy: 2,
    unhealthy: 1,
  },
  images: { total: 4, size: 1024 },
  volumes: 2,
  networks: 3,
  stacks: 1,
};

function renderDashboardHook(envId = 1) {
  const Wrapper = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return renderHook(() => useDashboard(envId), { wrapper: Wrapper });
}

describe('useDashboard', () => {
  it('loads dashboard stats for the environment', async () => {
    server.use(
      http.get('/api/docker/1/dashboard', () =>
        HttpResponse.json(dashboardPayload)
      )
    );

    const { result } = renderDashboardHook();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(dashboardPayload);
  });

  it('surfaces a parsed error when the request fails', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/docker/1/dashboard', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );

    const { result } = renderDashboardHook();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
    restore();
  });
});
