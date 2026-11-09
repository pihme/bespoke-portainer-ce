import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import {
  deleteTemplate,
  useDeleteTemplateMutation,
} from './useDeleteTemplateMutation';

describe('REQ-TPL-03 useDeleteTemplateMutation', () => {
  it('deleteTemplate calls DELETE on the template id', async () => {
    let deletedId = '';
    server.use(
      http.delete('/api/custom_templates/:id', ({ params }) => {
        deletedId = String(params.id);
        return new HttpResponse(null, { status: 204 });
      })
    );

    await expect(deleteTemplate(12)).resolves.toBeUndefined();
    expect(deletedId).toBe('12');
  });

  it('deleteTemplate surfaces API errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.delete('/api/custom_templates/:id', () =>
        HttpResponse.json({ message: 'denied' }, { status: 403 })
      )
    );

    await expect(deleteTemplate(12)).rejects.toThrow();
    restore();
  });

  it('mutation deletes a template successfully', async () => {
    server.use(
      http.delete('/api/custom_templates/:id', () =>
        new HttpResponse(null, { status: 204 })
      )
    );

    const { result } = renderHook(() => useDeleteTemplateMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    result.current.mutate(12);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
