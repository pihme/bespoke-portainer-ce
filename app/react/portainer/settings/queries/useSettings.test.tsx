import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import {
  useSettings,
  useUpdateSettingsMutation,
} from './useSettings';

const sampleSettings = {
  LogoURL: '',
  BlackListedLabels: [],
  AuthenticationMethod: 1,
  SnapshotInterval: '5m',
  TemplatesURL: '',
  EnableEdgeComputeFeatures: false,
  UserSessionTimeout: '8h',
  EnableTelemetry: false,
  HelmRepositoryURL: '',
  KubectlShellImage: '',
  TrustOnFirstConnect: false,
  EnforceCodeWorkbench: false,
  Edge: {
    PingInterval: 0,
    SnapshotInterval: 0,
    CommandInterval: 0,
  },
};

describe('useSettings', () => {
  it('loads application settings', async () => {
    server.use(
      http.get('/api/settings', () => HttpResponse.json(sampleSettings))
    );

    const { result } = renderHook(() => useSettings(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ SnapshotInterval: '5m' });
  });

  it('applies select and stays idle when disabled', async () => {
    server.use(
      http.get('/api/settings', () => HttpResponse.json(sampleSettings))
    );

    const { result: selected } = renderHook(
      () => useSettings((s) => s.SnapshotInterval),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );
    await waitFor(() => expect(selected.current.isSuccess).toBe(true));
    expect(selected.current.data).toBe('5m');

    const { result: disabled } = renderHook(() => useSettings(undefined, false), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    expect(disabled.current.fetchStatus).toBe('idle');
  });
});

describe('useUpdateSettingsMutation', () => {
  it('updates settings via PUT', async () => {
    let body: unknown;
    server.use(
      http.get('/api/settings', () => HttpResponse.json(sampleSettings)),
      http.put('/api/settings', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...sampleSettings, SnapshotInterval: '10m' });
      })
    );

    const { result } = renderHook(() => useUpdateSettingsMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await act(async () => {
      await result.current.mutateAsync({ SnapshotInterval: '10m' });
    });

    expect(body).toMatchObject({ SnapshotInterval: '10m' });
  });

  it('surfaces update errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.put('/api/settings', () =>
        HttpResponse.json({ message: 'denied' }, { status: 403 })
      )
    );

    const { result } = renderHook(() => useUpdateSettingsMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await expect(
      result.current.mutateAsync({ SnapshotInterval: '10m' })
    ).rejects.toThrow();
    restore();
  });
});
