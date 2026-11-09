import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { StackType } from '@/react/common/stacks/types';
import { Platform } from '@/react/portainer/templates/types';
import { ResourceControlOwnership } from '@/react/portainer/access-control/types';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useUpdateTemplateMutation } from './useUpdateTemplateMutation';

const updatePayload = {
  id: 8,
  Title: 'Updated',
  Description: 'desc',
  Type: StackType.DockerCompose,
  Platform: Platform.LINUX,
  FileContent: 'services: {}',
};

describe('REQ-TPL-03 useUpdateTemplateMutation', () => {
  it('updates a local custom template via PUT', async () => {
    let body: unknown;
    server.use(
      http.put('/api/custom_templates/8', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ Id: 8, Title: 'Updated' });
      })
    );

    const { result } = renderHook(() => useUpdateTemplateMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    result.current.mutate(updatePayload);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(body).toMatchObject({ Title: 'Updated', id: 8 });
  });

  it('applies access control when a resource control id is set', async () => {
    let resourceControlBody: unknown;
    server.use(
      http.put('/api/custom_templates/8', () =>
        HttpResponse.json({ Id: 8, Title: 'Updated' })
      ),
      http.put('/api/resource_controls/:id', async ({ request, params }) => {
        expect(params.id).toBe('44');
        resourceControlBody = await request.json();
        return HttpResponse.json({ success: true });
      })
    );

    const { result } = renderHook(() => useUpdateTemplateMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    result.current.mutate({
      ...updatePayload,
      resourceControlId: 44,
      AccessControl: {
        ownership: ResourceControlOwnership.PRIVATE,
        authorizedUsers: [1],
        authorizedTeams: [],
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(resourceControlBody).toBeTruthy();
  });

  it('surfaces API errors on update', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.put('/api/custom_templates/8', () =>
        HttpResponse.json({ message: 'conflict' }, { status: 409 })
      )
    );

    const { result } = renderHook(() => useUpdateTemplateMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    result.current.mutate(updatePayload);

    await waitFor(() => expect(result.current.isError).toBe(true));
    restore();
  });
});
