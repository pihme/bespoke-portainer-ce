import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

import { usePublicSettings } from './usePublicSettings';

const samplePublic = {
  EnableTelemetry: false,
  LogoURL: '',
  KubeconfigExpiry: '12h',
  Features: {},
};

describe('usePublicSettings', () => {
  it('loads public settings and invokes onSuccess', async () => {
    const onSuccess = vi.fn();
    server.use(
      http.get('/api/settings/public', () => HttpResponse.json(samplePublic))
    );

    const { result } = renderHook(
      () => usePublicSettings({ onSuccess }),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ KubeconfigExpiry: '12h' });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('applies select and stays idle when disabled', async () => {
    server.use(
      http.get('/api/settings/public', () => HttpResponse.json(samplePublic))
    );

    const { result: selected } = renderHook(
      () =>
        usePublicSettings({
          select: (s) => s.KubeconfigExpiry,
        }),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );
    await waitFor(() => expect(selected.current.isSuccess).toBe(true));
    expect(selected.current.data).toBe('12h');

    const { result: disabled } = renderHook(
      () => usePublicSettings({ enabled: false }),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );
    expect(disabled.current.fetchStatus).toBe('idle');
  });
});
