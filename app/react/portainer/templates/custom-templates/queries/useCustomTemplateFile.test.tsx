import { suppressConsoleLogs } from '@/setup-tests/suppress-console';
import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

import {
  getCustomTemplateFile,
  useCustomTemplateFile,
  useCustomTemplateFileMutation,
} from './useCustomTemplateFile';

describe('REQ-TPL-03 useCustomTemplateFile', () => {
  it('getCustomTemplateFile loads file content for a local template', async () => {
    server.use(
      http.get('/api/custom_templates/9/file', () =>
        HttpResponse.json({ FileContent: 'services:\n  web:\n    image: nginx' })
      )
    );

    await expect(getCustomTemplateFile({ id: 9, git: false })).resolves.toBe(
      'services:\n  web:\n    image: nginx'
    );
  });

  it('getCustomTemplateFile fetches from git when git is true', async () => {
    server.use(
      http.put('/api/custom_templates/9/git_fetch', () =>
        HttpResponse.json({ FileContent: 'version: "3"' })
      )
    );

    await expect(getCustomTemplateFile({ id: 9, git: true })).resolves.toBe(
      'version: "3"'
    );
  });

  it('surfaces API errors for file and git fetch', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/custom_templates/9/file', () =>
        HttpResponse.json({ message: 'no file' }, { status: 404 })
      ),
      http.put('/api/custom_templates/9/git_fetch', () =>
        HttpResponse.json({ message: 'git fail' }, { status: 500 })
      )
    );

    await expect(
      getCustomTemplateFile({ id: 9, git: false })
    ).rejects.toThrow();
    await expect(getCustomTemplateFile({ id: 9, git: true })).rejects.toThrow();
    restore();
  });

  it('loads the file through the query hook when an id is provided', async () => {
    server.use(
      http.get('/api/custom_templates/9/file', () =>
        HttpResponse.json({ FileContent: 'compose: ok' })
      )
    );

    const { result } = renderHook(() => useCustomTemplateFile(9, false), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('compose: ok');
  });

  it('stays disabled without an id', () => {
    const { result } = renderHook(() => useCustomTemplateFile(undefined), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useCustomTemplateFileMutation fetches file content on demand', async () => {
    server.use(
      http.get('/api/custom_templates/9/file', () =>
        HttpResponse.json({ FileContent: 'on-demand' })
      )
    );

    const { result } = renderHook(() => useCustomTemplateFileMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 9, git: false })
      ).resolves.toBe('on-demand');
    });
  });
});
