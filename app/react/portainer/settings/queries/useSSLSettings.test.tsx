import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useSSLSettings } from './useSSLSettings';

const sampleSsl = {
  certPath: '/certs/cert.pem',
  keyPath: '/certs/key.pem',
  caCertPath: '',
  selfSigned: true,
  httpEnabled: true,
};

describe('useSSLSettings', () => {
  it('loads SSL settings from /ssl', async () => {
    server.use(http.get('/api/ssl', () => HttpResponse.json(sampleSsl)));

    const { result } = renderHook(() => useSSLSettings(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleSsl);
  });

  it('surfaces SSL retrieval errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/ssl', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useSSLSettings(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    restore();
  });
});
