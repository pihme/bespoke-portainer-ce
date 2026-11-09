import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { withTestRouter } from '@/react/test-utils/withRouter';

import { LogView } from './LogView';

const containerState = vi.hoisted(() => ({
  data: undefined as
    | undefined
    | { HostConfig?: { LogConfig?: { Type?: string } } },
  isLoading: false,
}));

vi.mock('@uirouter/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uirouter/react')>();
  return {
    ...actual,
    useCurrentStateAndParams: () => ({
      params: { endpointId: 1, id: 'c1', nodeName: 'n1' },
    }),
  };
});

vi.mock('@/react/docker/containers/queries/useContainer', () => ({
  useContainer: (
    _args: unknown,
    opts?: { select?: (c: unknown) => unknown }
  ) => {
    const raw = containerState.data;
    return {
      data: raw && opts?.select ? opts.select(raw) : raw,
      isLoading: containerState.isLoading,
    };
  },
}));

vi.mock('@/docker/models/containerDetails', () => ({
  ContainerDetailsViewModel: class {
    HostConfig?: { LogConfig?: { Type?: string } };
    constructor(data: { HostConfig?: { LogConfig?: { Type?: string } } }) {
      this.HostConfig = data.HostConfig;
    }
  },
}));

describe('LogView', () => {
  it('returns null while loading or without data', () => {
    containerState.data = undefined;
    containerState.isLoading = true;
    const Wrapped = withTestRouter(LogView);
    const { rerender } = render(<Wrapped />);
    expect(screen.queryByText(/Logging is disabled/)).not.toBeInTheDocument();

    containerState.isLoading = false;
    containerState.data = undefined;
    rerender(<Wrapped />);
    expect(screen.queryByText(/Logging is disabled/)).not.toBeInTheDocument();
  });

  it('shows the disabled logging panel when log driver is none', () => {
    containerState.data = { HostConfig: { LogConfig: { Type: 'none' } } };
    containerState.isLoading = false;
    const Wrapped = withTestRouter(LogView);
    render(<Wrapped />);
    expect(screen.getByText(/Logging is disabled/)).toBeVisible();
    expect(screen.getByTestId('redeploy-container-link')).toBeVisible();
  });

  it('renders nothing when logging is enabled', () => {
    containerState.data = { HostConfig: { LogConfig: { Type: 'json-file' } } };
    containerState.isLoading = false;
    const Wrapped = withTestRouter(LogView);
    render(<Wrapped />);
    expect(screen.queryByText(/Logging is disabled/)).not.toBeInTheDocument();
  });

  it('treats missing log config as disabled', () => {
    containerState.data = { HostConfig: {} };
    containerState.isLoading = false;
    const Wrapped = withTestRouter(LogView);
    render(<Wrapped />);
    expect(screen.getByText(/Logging is disabled/)).toBeVisible();
  });
});
