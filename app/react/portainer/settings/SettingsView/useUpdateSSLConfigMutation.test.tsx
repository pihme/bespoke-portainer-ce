import { renderHook, act } from '@testing-library/react-hooks';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

import { useUpdateSSLConfigMutation } from './useUpdateSSLConfigMutation';

function fakeFile(content: string): File {
  return {
    text: async () => content,
  } as unknown as File;
}

describe('REQ-SET-04 useUpdateSSLConfigMutation', () => {
  it('uploads SSL cert and key files as text', async () => {
    let body: unknown;
    server.use(
      http.put('/api/ssl', async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      })
    );

    const { result } = renderHook(() => useUpdateSSLConfigMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await act(async () => {
      await result.current.mutateAsync({
        certFile: fakeFile('CERT'),
        keyFile: fakeFile('KEY'),
        httpEnabled: true,
      });
    });

    expect(body).toMatchObject({
      cert: 'CERT',
      key: 'KEY',
      httpEnabled: true,
    });
  });

  it('uploads a client cert alone', async () => {
    let body: unknown;
    server.use(
      http.put('/api/ssl', async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      })
    );

    const { result } = renderHook(() => useUpdateSSLConfigMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await act(async () => {
      await result.current.mutateAsync({
        clientCertFile: fakeFile('CLIENT'),
      });
    });

    expect(body).toMatchObject({ clientCert: 'CLIENT' });
  });
});
