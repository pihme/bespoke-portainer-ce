import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { TemplateType } from '@/react/portainer/templates/app-templates/types';

import {
  getAppTemplates,
  useAppTemplate,
  useAppTemplates,
} from './useAppTemplates';

const sampleTemplate = {
  id: 5,
  type: TemplateType.Container,
  title: 'Redis',
  description: 'in-memory store',
  administrator_only: false,
  image: 'redis:latest',
  registry: 'registry.example.com',
  repository: { url: '', stackfile: '' },
};

describe('REQ-TPL-01 useAppTemplates and getAppTemplates', () => {
  it('getAppTemplates returns the API payload', async () => {
    server.use(
      http.get('/api/templates', () =>
        HttpResponse.json({ version: '3', templates: [sampleTemplate] })
      )
    );

    await expect(getAppTemplates()).resolves.toEqual({
      version: '3',
      templates: [sampleTemplate],
    });
  });

  it('getAppTemplates surfaces API errors', async () => {
    server.use(
      http.get('/api/templates', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );

    await expect(getAppTemplates()).rejects.toThrow();
  });

  it('REQ-TAI-005 loads templates without querying registries', async () => {
    server.use(
      http.get('/api/templates', () =>
        HttpResponse.json({ version: '3', templates: [sampleTemplate] })
      )
    );

    const { result } = renderHook(
      () => useAppTemplates({ environmentId: 3 }),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].Title).toBe('Redis');
    expect(result.current.data?.[0].RegistryModel.Image).toBe(
      'registry.example.com/redis:latest'
    );
    expect(result.current.data?.[0].RegistryModel).not.toHaveProperty(
      'Registry'
    );
  });

  it('useAppTemplate selects a single template by id', async () => {
    server.use(
      http.get('/api/templates', () =>
        HttpResponse.json({
          version: '3',
          templates: [
            sampleTemplate,
            { ...sampleTemplate, id: 6, title: 'Other' },
          ],
        })
      )
    );

    const { result } = renderHook(() => useAppTemplate(5), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.Title).toBe('Redis');
    expect(result.current.data?.Id).toBe(5);
  });

  it('stays disabled when enabled is false', () => {
    const { result } = renderHook(
      () => useAppTemplates({ enabled: false }),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    expect(result.current.fetchStatus).toBe('idle');
  });
});
