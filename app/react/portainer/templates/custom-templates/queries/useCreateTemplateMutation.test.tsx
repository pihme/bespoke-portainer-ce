import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';
import { ResourceControlOwnership } from '@/react/portainer/access-control/types';
import { getDefaultModel } from '@/react/portainer/gitops/types';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useCreateTemplateMutation } from './useCreateTemplateMutation';

const basePayload = {
  Platform: Platform.LINUX,
  Type: StackType.DockerCompose,
  FileContent: 'services:\n  web:\n    image: nginx',
  File: undefined as File | undefined,
  Git: getDefaultModel(),
  Variables: [] as [],
  Title: 'Nginx',
  Description: 'web',
  Note: '',
  Logo: '',
};

const createdTemplate = {
  Id: 21,
  Title: 'Nginx',
  Description: 'web',
  ProjectPath: '/data/custom_template/21',
  EntryPoint: 'docker-compose.yml',
  CreatedByUserId: 1,
  Note: '',
  Platform: Platform.LINUX,
  Logo: '',
  Type: StackType.DockerCompose,
  Variables: [],
  ResourceControl: {
    Id: 55,
    Type: 6,
    ResourceId: '21',
    UserAccesses: [],
    TeamAccesses: [],
    Public: false,
    AdministratorsOnly: false,
    System: false,
  },
};

describe('REQ-TPL-03 useCreateTemplateMutation', () => {
  it('creates a template from the web editor', async () => {
    let path = '';
    let body: unknown;
    server.use(
      http.post('/api/custom_templates/create/string', async ({ request }) => {
        path = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json(createdTemplate);
      })
    );

    const { result } = renderHook(() => useCreateTemplateMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await act(async () => {
      const template = await result.current.mutateAsync({
        ...basePayload,
        Method: 'editor',
      });
      expect(template.Id).toBe(21);
    });

    expect(path).toBe('/api/custom_templates/create/string');
    expect(body).toMatchObject({
      Title: 'Nginx',
      FileContent: basePayload.FileContent,
    });
  });

  it('creates a template from an uploaded file', async () => {
    let path = '';
    server.use(
      http.post('/api/custom_templates/create/file', async ({ request }) => {
        path = new URL(request.url).pathname;
        const form = await request.formData();
        expect(form.get('Title')).toBe('Nginx');
        expect(form.get('File')).toBeTruthy();
        return HttpResponse.json(createdTemplate);
      })
    );

    const file = new File(['services: {}'], 'compose.yml', {
      type: 'text/yaml',
    });

    const { result } = renderHook(() => useCreateTemplateMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await act(async () => {
      await result.current.mutateAsync({
        ...basePayload,
        Method: 'upload',
        File: file,
      });
    });

    expect(path).toBe('/api/custom_templates/create/file');
    expect(result.current.isSuccess).toBe(true);
  });

  it('rejects upload when no file is provided', async () => {
    const restore = suppressConsoleLogs();
    const { result } = renderHook(() => useCreateTemplateMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    result.current.mutate({
      ...basePayload,
      Method: 'upload',
      File: undefined,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    restore();
  });

  it('creates a template from a git repository', async () => {
    let path = '';
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(
        '/api/custom_templates/create/repository',
        async ({ request }) => {
          path = new URL(request.url).pathname;
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(createdTemplate);
        }
      )
    );

    const { result } = renderHook(() => useCreateTemplateMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await act(async () => {
      await result.current.mutateAsync({
        ...basePayload,
        Method: 'repository',
        Git: {
          ...getDefaultModel(),
          SourceId: 3,
          ComposeFilePathInRepository: 'compose.yml',
        },
      });
    });

    expect(path).toBe('/api/custom_templates/create/repository');
    expect(body).toMatchObject({
      Title: 'Nginx',
      SourceId: 3,
      ComposeFilePathInRepository: 'compose.yml',
    });
  });

  it('applies access control after create when ResourceControl is present', async () => {
    let resourceControlCalled = false;
    server.use(
      http.post('/api/custom_templates/create/string', () =>
        HttpResponse.json(createdTemplate)
      ),
      http.put('/api/resource_controls/:id', ({ params }) => {
        expect(params.id).toBe('55');
        resourceControlCalled = true;
        return HttpResponse.json({ success: true });
      })
    );

    const { result } = renderHook(() => useCreateTemplateMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await act(async () => {
      await result.current.mutateAsync({
        ...basePayload,
        Method: 'editor',
        AccessControl: {
          ownership: ResourceControlOwnership.PRIVATE,
          authorizedUsers: [1],
          authorizedTeams: [],
        },
      });
    });

    expect(resourceControlCalled).toBe(true);
  });

  it('surfaces API errors on create from editor', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/custom_templates/create/string', () =>
        HttpResponse.json({ message: 'bad' }, { status: 400 })
      )
    );

    const { result } = renderHook(() => useCreateTemplateMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    result.current.mutate({
      ...basePayload,
      Method: 'editor',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    restore();
  });

  it('surfaces API errors on create from repository', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/custom_templates/create/repository', () =>
        HttpResponse.json({ message: 'git bad' }, { status: 400 })
      )
    );

    const { result } = renderHook(() => useCreateTemplateMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    result.current.mutate({
      ...basePayload,
      Method: 'repository',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    restore();
  });

  it('rejects an unknown method', async () => {
    const restore = suppressConsoleLogs();
    const { result } = renderHook(() => useCreateTemplateMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    result.current.mutate({
      ...basePayload,
      Method: 'unknown' as 'editor',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(String(result.current.error)).toMatch(/Unknown method/);
    restore();
  });
});
