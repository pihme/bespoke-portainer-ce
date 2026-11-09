import { createElement, Fragment } from 'react';
import { act, renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

const gitOpsSourceGet = vi.fn();
const gitOpsSourcesDelete = vi.fn();
const gitOpsSourcesUpdateGit = vi.fn();
const gitOpsSourcesTestById = vi.fn();
const gitOpsSourceWorkflowsList = vi.fn();
const gitOpsSourcesUpdateAccess = vi.fn();

vi.mock('@api/sdk.gen', () => ({
  gitOpsSourceGet: (...args: unknown[]) => gitOpsSourceGet(...args),
  gitOpsSourcesDelete: (...args: unknown[]) => gitOpsSourcesDelete(...args),
  gitOpsSourcesUpdateGit: (...args: unknown[]) => gitOpsSourcesUpdateGit(...args),
  gitOpsSourcesTestById: (...args: unknown[]) => gitOpsSourcesTestById(...args),
  gitOpsSourceWorkflowsList: (...args: unknown[]) =>
    gitOpsSourceWorkflowsList(...args),
  gitOpsSourcesUpdateAccess: (...args: unknown[]) =>
    gitOpsSourcesUpdateAccess(...args),
}));

import { sourceQueryKeys } from './query-keys';
import { getSource, useSource } from './useSource';
import { useSources } from './useSources';
import { useSourcesSummary } from './useSourcesSummary';
import { useDeleteSourceMutation } from './useDeleteSourceMutation';
import { useUpdateSourceMutation } from './useUpdateSourceMutation';
import { useTestSourceConnectionMutation } from './useTestSourceConnectionMutation';
import { getSourceWorkflows, useSourceWorkflows } from './useSourceWorkflows';

function Wrapper({ children }: { children: React.ReactNode }) {
  const W = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return createElement(W, null, children);
}

describe('local gitops source queries', () => {
  beforeEach(() => {
    gitOpsSourceGet.mockReset();
    gitOpsSourcesDelete.mockReset();
    gitOpsSourcesUpdateGit.mockReset();
    gitOpsSourcesTestById.mockReset();
    gitOpsSourceWorkflowsList.mockReset();
    gitOpsSourcesUpdateAccess.mockReset();
  });

  it('sourceQueryKeys builds list detail summary and workflows keys', () => {
    expect(sourceQueryKeys.all).toEqual(['gitops', 'sources']);
    expect(sourceQueryKeys.list({ search: 'a' })).toEqual([
      'gitops',
      'sources',
      'list',
      { search: 'a' },
    ]);
    expect(sourceQueryKeys.detail(3)).toEqual([
      'gitops',
      'sources',
      'detail',
      3,
    ]);
    expect(sourceQueryKeys.summary()).toEqual(['gitops', 'sources', 'summary']);
    expect(sourceQueryKeys.workflows(3)).toEqual([
      'gitops',
      'sources',
      'detail',
      3,
      'workflows',
    ]);
  });

  it('useSources and useSourcesSummary load via axios', async () => {
    server.use(
      http.get('/api/gitops/sources', () =>
        HttpResponse.json([{ id: 1, name: 'src' }], {
          headers: { 'x-total-count': '1' },
        })
      ),
      http.get('/api/gitops/sources/summary', () =>
        HttpResponse.json({ healthy: 2, error: 0 })
      )
    );

    const sources = renderHook(() => useSources({ search: 'src' }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(sources.result.current.isSuccess).toBe(true));
    expect(sources.result.current.data?.value?.[0]?.name || sources.result.current.data).toBeTruthy();

    const summary = renderHook(() => useSourcesSummary(), { wrapper: Wrapper });
    await waitFor(() => expect(summary.result.current.isSuccess).toBe(true));
    expect(summary.result.current.data).toMatchObject({ healthy: 2 });
  });

  it('getSource and useSource load a source detail', async () => {
    gitOpsSourceGet.mockResolvedValue({
      data: { id: 7, name: 'local-src', type: 'git' },
    });
    await expect(getSource(7)).resolves.toMatchObject({ id: 7, name: 'local-src' });

    const { result } = renderHook(() => useSource(7), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('local-src');
  });

  it('mutations delete update and test local sources', async () => {
    gitOpsSourcesDelete.mockResolvedValue({});
    gitOpsSourcesUpdateGit.mockResolvedValue({});
    gitOpsSourcesTestById.mockResolvedValue({
      data: { success: true },
    });

    const del = renderHook(() => useDeleteSourceMutation(), { wrapper: Wrapper });
    await act(async () => {
      await del.result.current.mutateAsync(9);
    });
    expect(gitOpsSourcesDelete).toHaveBeenCalledWith({ path: { id: 9 } });

    const upd = renderHook(() => useUpdateSourceMutation(9), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await upd.result.current.mutateAsync({ URL: 'https://example.com/r.git' } as never);
    });
    expect(gitOpsSourcesUpdateGit).toHaveBeenCalled();

    const test = renderHook(() => useTestSourceConnectionMutation(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await test.result.current.mutateAsync({ id: 9, payload: {} });
    });
    expect(gitOpsSourcesTestById).toHaveBeenCalled();
  });

  it('getSourceWorkflows maps workflow git config helpers', async () => {
    gitOpsSourceWorkflowsList.mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'wf',
          status: 'healthy',
          creationDate: undefined,
          lastSyncDate: undefined,
          target: { type: 'stack' },
          gitConfig: {
            URL: 'https://github.com/a/b',
            ReferenceName: 'refs/heads/main',
            ConfigFilePath: 'docker-compose.yml',
            ConfigHash: 'abc',
            TLSSkipVerify: true,
            Authentication: { Username: 'u', Password: 'p' },
          },
        },
        {
          id: 2,
          name: 'wf2',
          status: 'error',
          target: { type: 'stack' },
        },
      ],
    });

    const workflows = await getSourceWorkflows(4);
    expect(workflows[0].creationDate).toBe(0);
    expect(workflows[0].gitConfig?.URL).toBe('https://github.com/a/b');
    expect(workflows[0].gitConfig?.Authentication?.Username).toBe('u');
    expect(workflows[1].gitConfig).toBeUndefined();

    const { result } = renderHook(() => useSourceWorkflows(4), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });
});
