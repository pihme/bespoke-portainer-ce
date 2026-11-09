import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useExperimentalSettings } from './useExperimentalSettings';

const sampleExperimental = {
  experimentalFeatures: {},
};

describe('useExperimentalSettings', () => {
  it('loads experimental settings', async () => {
    server.use(
      http.get('/api/settings/experimental', () =>
        HttpResponse.json(sampleExperimental)
      )
    );

    const { result } = renderHook(() => useExperimentalSettings(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleExperimental);
  });

  it('applies select, respects enabled, and surfaces errors', async () => {
    server.use(
      http.get('/api/settings/experimental', () =>
        HttpResponse.json(sampleExperimental)
      )
    );

    const { result: selected } = renderHook(
      () => useExperimentalSettings((s) => s.experimentalFeatures),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );
    await waitFor(() => expect(selected.current.isSuccess).toBe(true));
    expect(selected.current.data).toEqual({});

    const { result: disabled } = renderHook(
      () => useExperimentalSettings(undefined, false),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );
    expect(disabled.current.fetchStatus).toBe('idle');

    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/settings/experimental', () =>
        HttpResponse.json({ message: 'fail' }, { status: 500 })
      )
    );
    const { result: errored } = renderHook(() => useExperimentalSettings(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    await waitFor(() => expect(errored.current.isError).toBe(true));
    restore();
  });
});
