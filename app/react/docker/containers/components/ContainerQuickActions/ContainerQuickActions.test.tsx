import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ContainerStatus } from '@/react/docker/containers/types';

vi.mock('@/react/hooks/useUser', () => ({
  Authorized: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@@/Link', () => ({
  Link: ({
    children,
    title,
    'data-cy': dataCy,
  }: {
    children: React.ReactNode;
    title?: string;
    'data-cy'?: string;
  }) => (
    <a title={title} data-cy={dataCy}>
      {children}
    </a>
  ),
}));

import { ContainerQuickActions } from './ContainerQuickActions';

const allOn = {
  showQuickActionAttach: true,
  showQuickActionExec: true,
  showQuickActionInspect: true,
  showQuickActionLogs: true,
  showQuickActionStats: true,
};

describe('ContainerQuickActions', () => {
  it('shows logs and inspect always when enabled, and active-only actions when running', () => {
    render(
      <ContainerQuickActions
        containerId="c1"
        nodeName=""
        status={ContainerStatus.Running}
        state={allOn}
      />
    );
    expect(screen.getByTitle('Logs')).toBeInTheDocument();
    expect(screen.getByTitle('Inspect')).toBeInTheDocument();
    expect(screen.getByTitle('Stats')).toBeInTheDocument();
    expect(screen.getByTitle('Exec Console')).toBeInTheDocument();
    expect(screen.getByTitle('Attach Console')).toBeInTheDocument();
  });

  it('hides active-only actions when the container is stopped', () => {
    render(
      <ContainerQuickActions
        containerId="c1"
        nodeName=""
        status={ContainerStatus.Stopped}
        state={allOn}
      />
    );
    expect(screen.getByTitle('Logs')).toBeInTheDocument();
    expect(screen.queryByTitle('Stats')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Exec Console')).not.toBeInTheDocument();
  });
});
