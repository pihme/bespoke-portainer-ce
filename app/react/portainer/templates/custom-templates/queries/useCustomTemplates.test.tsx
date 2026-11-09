import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useCustomTemplates } from './useCustomTemplates';

const sampleTemplate = {
  Id: 3,
  Title: 'Nginx',
  Description: 'web server',
  ProjectPath: '/data/custom_template/3',
  EntryPoint: 'docker-compose.yml',
  CreatedByUserId: 1,
  Note: '',
  Platform: Platform.LINUX,
  Logo: '',
  Type: StackType.DockerCompose,
  Variables: [],
};

describe('REQ-TPL-03 useCustomTemplates', () => {
  it('loads custom templates for local Compose use', async () => {
    let capturedType: string | null = null;
    let capturedEdge: string | null = null;

    server.use(
      http.get('/api/custom_templates', ({ request }) => {
        const url = new URL(request.url);
        capturedType = url.searchParams.get('type');
        capturedEdge = url.searchParams.get('edge');
        return HttpResponse.json([sampleTemplate]);
      })
    );

    const { result } = renderHook(
      () =>
        useCustomTemplates({
          params: { type: [StackType.DockerCompose], edge: false },
        }),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleTemplate]);
    expect(capturedType).toBe(String(StackType.DockerCompose));
    expect(capturedEdge).toBe('false');
  });

  it('applies a select transform', async () => {
    server.use(
      http.get('/api/custom_templates', () =>
        HttpResponse.json([sampleTemplate])
      )
    );

    const { result } = renderHook(
      () =>
        useCustomTemplates({
          select: (templates) => templates.map((t) => t.Title),
        }),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(['Nginx']);
  });

  it('surfaces API errors when listing fails', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/custom_templates', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useCustomTemplates(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    restore();
  });
});
