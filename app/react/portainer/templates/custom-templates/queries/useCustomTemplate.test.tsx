import { suppressConsoleLogs } from '@/setup-tests/suppress-console';
import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';

import { getCustomTemplate, useCustomTemplate } from './useCustomTemplate';

const sampleTemplate = {
  Id: 5,
  Title: 'Redis',
  Description: 'cache',
  ProjectPath: '/data/custom_template/5',
  EntryPoint: 'docker-compose.yml',
  CreatedByUserId: 1,
  Note: '',
  Platform: Platform.LINUX,
  Logo: '',
  Type: StackType.DockerCompose,
  Variables: [],
};

describe('REQ-TPL-03 useCustomTemplate', () => {
  it('getCustomTemplate returns the API payload', async () => {
    server.use(
      http.get('/api/custom_templates/5', () =>
        HttpResponse.json(sampleTemplate)
      )
    );

    await expect(getCustomTemplate(5)).resolves.toEqual(sampleTemplate);
  });

  it('getCustomTemplate surfaces API errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/custom_templates/5', () =>
        HttpResponse.json({ message: 'missing' }, { status: 404 })
      )
    );

    await expect(getCustomTemplate(5)).rejects.toThrow();
    restore();
  });

  it('loads a single template by id', async () => {
    server.use(
      http.get('/api/custom_templates/5', () =>
        HttpResponse.json(sampleTemplate)
      )
    );

    const { result } = renderHook(() => useCustomTemplate(5), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.Title).toBe('Redis');
  });

  it('stays disabled without an id or when enabled is false', () => {
    const { result: withoutId } = renderHook(
      () => useCustomTemplate(undefined),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );
    expect(withoutId.current.fetchStatus).toBe('idle');

    const { result: disabled } = renderHook(
      () => useCustomTemplate(5, { enabled: false }),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );
    expect(disabled.current.fetchStatus).toBe('idle');
  });
});
