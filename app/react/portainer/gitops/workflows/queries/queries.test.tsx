import { createElement, Fragment } from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

const gitOpsWorkflowGet = vi.fn();
const gitOpsWorkflowsList = vi.fn();
const gitOpsSourceGet = vi.fn();

vi.mock('@api/sdk.gen', () => ({
  gitOpsWorkflowGet: (...args: unknown[]) => gitOpsWorkflowGet(...args),
  gitOpsWorkflowsList: (...args: unknown[]) => gitOpsWorkflowsList(...args),
  gitOpsSourceGet: (...args: unknown[]) => gitOpsSourceGet(...args),
}));

import { useWorkflow } from './useWorkflow';
import { useWorkflows } from './useWorkflows';
import { useWorkflowSources } from './useWorkflowSources';
import { WorkflowArtifact } from '../types';

function Wrapper({ children }: { children: React.ReactNode }) {
  const W = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return createElement(W, null, children);
}

describe('useWorkflow', () => {
  beforeEach(() => {
    gitOpsWorkflowGet.mockReset();
  });

  it('stays idle when id is undefined', async () => {
    const { result } = renderHook(() => useWorkflow(undefined), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(gitOpsWorkflowGet).not.toHaveBeenCalled();
  });

  it('loads and maps a workflow by id', async () => {
    gitOpsWorkflowGet.mockResolvedValue({
      data: {
        id: 3,
        name: 'demo',
        status: {
          source: { status: 'healthy' },
          artifact: { status: 'healthy' },
          target: { status: 'healthy' },
        },
        artifacts: [],
      },
    });

    const { result } = renderHook(() => useWorkflow(3), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('demo');
    expect(gitOpsWorkflowGet).toHaveBeenCalledWith({ path: { id: 3 } });
  });
});

describe('useWorkflows', () => {
  beforeEach(() => {
    gitOpsWorkflowsList.mockReset();
  });

  it('lists workflows and applies pagination headers', async () => {
    gitOpsWorkflowsList.mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'one',
          status: {
            source: { status: 'healthy' },
            artifact: { status: 'healthy' },
            target: { status: 'healthy' },
          },
          artifacts: [],
        },
      ],
      headers: { 'x-total-count': '1' },
    });

    const { result } = renderHook(() => useWorkflows({ search: 'one' }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.value?.[0]?.name || result.current.data).toBeTruthy();
    expect(gitOpsWorkflowsList).toHaveBeenCalledWith({
      query: { search: 'one' },
    });
  });

  it('maps a null list payload to an empty array', async () => {
    gitOpsWorkflowsList.mockResolvedValue({
      data: null,
      headers: {},
    });
    const { result } = renderHook(() => useWorkflows(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = result.current.data as { data?: unknown[]; value?: unknown[] };
    expect(data.data ?? data.value ?? data).toEqual(
      expect.anything()
    );
  });
});

describe('useWorkflowSources', () => {
  beforeEach(() => {
    gitOpsSourceGet.mockReset();
  });

  it('dedupes source ids across artifact files and loads each source', async () => {
    gitOpsSourceGet.mockImplementation(async ({ path }: { path: { id: number } }) => ({
      data: { id: path.id, name: `source-${path.id}` },
    }));

    const artifacts = [
      {
        files: [
          { sourceId: 2, path: 'a.yml', ref: 'main' },
          { sourceId: 2, path: 'b.yml', ref: 'main' },
          { sourceId: 5, path: 'c.yml', ref: 'main' },
        ],
      },
    ] as WorkflowArtifact[];

    const { result } = renderHook(() => useWorkflowSources(artifacts), {
      wrapper: Wrapper,
    });

    await waitFor(() =>
      expect(result.current.every((entry) => entry.query.isSuccess)).toBe(true)
    );
    expect(result.current.map((e) => e.sourceId).sort()).toEqual([2, 5]);
    expect(gitOpsSourceGet).toHaveBeenCalledTimes(2);
  });
});
