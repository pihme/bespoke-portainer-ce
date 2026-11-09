import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

import { fetchFilePreview, useAppTemplateFile } from './useAppTemplateFile';

describe('REQ-TPL-01 useAppTemplateFile', () => {
  it('fetchFilePreview returns the file content', async () => {
    server.use(
      http.post('/api/templates/11/file', () =>
        HttpResponse.json({ FileContent: 'services:\n  web:\n    image: nginx' })
      )
    );

    await expect(fetchFilePreview(11)).resolves.toBe(
      'services:\n  web:\n    image: nginx'
    );
  });

  it('fetchFilePreview surfaces API errors', async () => {
    server.use(
      http.post('/api/templates/11/file', () =>
        HttpResponse.json({ message: 'missing' }, { status: 404 })
      )
    );

    await expect(fetchFilePreview(11)).rejects.toThrow();
  });

  it('loads the file through the query hook when an id is provided', async () => {
    server.use(
      http.post('/api/templates/11/file', () =>
        HttpResponse.json({ FileContent: 'version: "3"' })
      )
    );

    const { result } = renderHook(() => useAppTemplateFile(11), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('version: "3"');
  });

  it('stays disabled without an id', () => {
    const { result } = renderHook(() => useAppTemplateFile(undefined), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
